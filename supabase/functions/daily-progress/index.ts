import { createClient } from 'npm:@supabase/supabase-js@2.106.2';

import {
  type DistanceProvider,
  type GpsSample,
  validateGpsSamples,
} from '../_shared/daily-verification.ts';
import {
  DISTANCE_RATE_LIMIT_PER_MINUTE,
  HEALTH_SYNC_ENABLED,
  isDevelopmentMockUser,
  MAX_MOVEMENT_SPEED_METERS_PER_SECOND,
  MAX_OFFLINE_SAMPLE_AGE_HOURS,
} from '../_shared/daily-config.ts';
import { hmacDigest } from '../_shared/spawn-algorithm.ts';
import { MAX_ACCEPTABLE_GPS_ACCURACY_METERS, requireSpawnHmacSecret } from '../_shared/spawn-config.ts';

type HealthActivity = {
  recordId?: string;
  activityType?: 'walking' | 'running' | 'cycling' | 'driving' | 'unknown';
  startedAt?: string;
  endedAt?: string;
  distanceMeters?: number;
  sourceName?: string;
};

type RequestBody = {
  action?: 'get' | 'set-timezone' | 'sync-distance' | 'claim-reward';
  timezone?: string;
  provider?: DistanceProvider;
  batchId?: string;
  gpsSamples?: GpsSample[];
  healthActivities?: HealthActivity[];
  missionId?: string;
  // Eligibility and mission booleans are intentionally absent. Unknown fields are ignored.
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function requireEnvironment(name: string) {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing server environment: ${name}`);
  return value;
}

function friendlyError(code: string, requestId: string, status: number) {
  const messages: Record<string, string> = {
    INVALID_GPS: 'We couldn’t verify this walk. Please try again.',
    HEALTH_DISABLED: 'Health app walks are not available yet.',
    DEVELOPMENT_PROVIDER_DISABLED: 'Practice walks are not available.',
    RATE_LIMITED: 'Please wait a moment, then try again.',
    INVALID_REQUEST: 'We couldn’t add this walk. Please try again.',
    REQUIREMENT_NOT_MET: 'Finish the mission on the Live Map before claiming its reward.',
    ALREADY_CLAIMED: 'This reward has already been claimed.',
  };
  return jsonResponse({ error: code, message: messages[code] ?? 'Today’s walk could not update. Please try again.', requestId }, status);
}

async function authenticatedClients(request: Request) {
  const authorization = request.headers.get('Authorization');
  if (!authorization?.startsWith('Bearer ')) return null;

  const url = requireEnvironment('SUPABASE_URL');
  const userClient = createClient(url, requireEnvironment('SUPABASE_ANON_KEY'), {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await userClient.auth.getUser();
  if (error || !data.user) return null;

  const admin = createClient(url, requireEnvironment('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return { user: data.user, admin };
}

function validHealthActivity(activity: HealthActivity, serverNow: number) {
  const start = Date.parse(activity.startedAt ?? '');
  const end = Date.parse(activity.endedAt ?? '');
  const distance = activity.distanceMeters ?? Number.NaN;
  const durationSeconds = (end - start) / 1_000;
  const averageSpeed = distance / durationSeconds;
  const oldest = serverNow - MAX_OFFLINE_SAMPLE_AGE_HOURS * 60 * 60 * 1_000;

  if (!activity.recordId || activity.activityType === 'cycling' || activity.activityType === 'driving') {
    return null;
  }
  if (activity.activityType !== 'walking' && activity.activityType !== 'running') return null;
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null;
  if (start < oldest || end > serverNow + 120_000) return null;
  if (!Number.isFinite(distance) || distance <= 0 || averageSpeed > MAX_MOVEMENT_SPEED_METERS_PER_SECOND) {
    return null;
  }
  return { start, end, distance, durationSeconds: Math.round(durationSeconds), averageSpeed };
}

Deno.serve(async (request) => {
  const requestId = crypto.randomUUID();
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });
  if (request.method !== 'POST') return friendlyError('INVALID_REQUEST', requestId, 405);

  try {
    const clients = await authenticatedClients(request);
    if (!clients) return jsonResponse({ error: 'UNAUTHORIZED', requestId }, 401);
    const { user, admin } = clients;
    const body = (await request.json().catch(() => ({}))) as RequestBody;
    const secret = requireSpawnHmacSecret();

    const rate = await admin.rpc('server_consume_field_rate_limit', {
      p_subject_key: `user:${user.id}`,
      p_endpoint: 'daily-progress',
      p_limit: DISTANCE_RATE_LIMIT_PER_MINUTE,
    });
    if (rate.error) throw new Error('RATE_CHECK_FAILED');
    if (!rate.data) return friendlyError('RATE_LIMITED', requestId, 429);

    if (body.action === 'set-timezone') {
      const result = await admin.rpc('server_set_user_timezone', {
        p_user_id: user.id,
        p_timezone_name: typeof body.timezone === 'string' ? body.timezone : 'UTC',
      });
      if (result.error) throw new Error('TIMEZONE_FAILED');
    } else if (body.action === 'claim-reward') {
      if (typeof body.missionId !== 'string' || !body.missionId) {
        return friendlyError('INVALID_REQUEST', requestId, 400);
      }
      const claim = await admin.rpc('server_claim_mission_reward', {
        p_user_id: user.id,
        p_mission_id: body.missionId,
      });
      if (claim.error || !claim.data?.[0]) throw new Error('MISSION_CLAIM_FAILED');
      if (!claim.data[0].claimed && claim.data[0].result_code !== 'ALREADY_CLAIMED') {
        return friendlyError(claim.data[0].result_code, requestId, 409);
      }
    } else if (body.action === 'sync-distance') {
      const provider = body.provider;
      if (!provider) return friendlyError('INVALID_REQUEST', requestId, 400);
      if ((provider === 'healthkit' || provider === 'health_connect') && !HEALTH_SYNC_ENABLED) {
        return friendlyError('HEALTH_DISABLED', requestId, 403);
      }
      if (provider === 'development_mock' && !isDevelopmentMockUser(user.id)) {
        return friendlyError('DEVELOPMENT_PROVIDER_DISABLED', requestId, 403);
      }

      const activeMission = await admin.rpc('server_has_active_mission', { p_user_id: user.id });
      if (activeMission.error) throw new Error('MISSION_STATE_FAILED');
      if (!activeMission.data) return friendlyError('REQUIREMENT_NOT_MET', requestId, 409);

      const payload = provider === 'gps' || provider === 'development_mock'
        ? body.gpsSamples ?? []
        : body.healthActivities ?? [];
      if (!body.batchId || payload.length < 1 || payload.length > 1000) {
        return friendlyError('INVALID_REQUEST', requestId, 400);
      }
      const batchDigest = await hmacDigest(
        secret,
        `distance-batch|${user.id}|${provider}|${body.batchId}|${JSON.stringify(payload)}`,
      );
      const batch = await admin.rpc('server_begin_distance_batch', {
        p_user_id: user.id,
        p_provider: provider,
        p_batch_digest: batchDigest,
        p_sample_count: payload.length,
      });
      if (batch.error || !batch.data?.[0]) throw new Error('BATCH_FAILED');
      if (batch.data[0].replayed) {
        const progress = await admin.rpc('server_get_verified_daily_progress', { p_user_id: user.id });
        return jsonResponse({ requestId, replayed: true, progress: progress.data });
      }

      const batchId = batch.data[0].batch_id;
      let acceptedCount = 0;
      let rejectedCount = 0;
      const suspiciousCodes = new Set<string>();

      if (provider === 'gps' || provider === 'development_mock') {
        const gpsSamples = body.gpsSamples ?? [];
        const validation = validateGpsSamples(gpsSamples, {
          serverNow: new Date(),
          maxAccuracyMeters: MAX_ACCEPTABLE_GPS_ACCURACY_METERS,
          maxSpeedMetersPerSecond: MAX_MOVEMENT_SPEED_METERS_PER_SECOND,
          maxOfflineAgeHours: MAX_OFFLINE_SAMPLE_AGE_HOURS,
          allowMocked: provider === 'development_mock',
        });
        rejectedCount += validation.rejected.length;
        validation.rejected.forEach((segment) => suspiciousCodes.add(segment.code));

        for (const segment of validation.accepted) {
          const segmentHash = await hmacDigest(
            secret,
            `distance-segment|${user.id}|${provider}|${segment.startSampleId}|${segment.endSampleId}|${segment.startedAt}|${segment.endedAt}`,
          );
          const recorded = await admin.rpc('server_record_verified_segment', {
            p_user_id: user.id, p_batch_id: batchId, p_source: provider,
            p_segment_hash: segmentHash, p_activity_type: 'walking',
            p_distance_meters: segment.distanceMeters, p_started_at: segment.startedAt,
            p_ended_at: segment.endedAt, p_duration_seconds: Math.round(segment.durationSeconds),
            p_average_speed_meters_per_second: segment.speedMetersPerSecond,
          });
          if (recorded.error) throw new Error('SEGMENT_FAILED');
          if (recorded.data?.[0]?.accepted) acceptedCount += 1;
          else { rejectedCount += 1; suspiciousCodes.add(recorded.data?.[0]?.rejection_code ?? 'DUPLICATE_OR_OVERLAP'); }
        }

        for (const sample of gpsSamples) {
          if (
            !Number.isFinite(sample.latitude) || !Number.isFinite(sample.longitude) ||
            !Number.isFinite(sample.accuracyMeters) || !Number.isFinite(Date.parse(sample.capturedAt))
          ) continue;
          const digest = await hmacDigest(secret, `sample|${user.id}|${provider}|${sample.sampleId}|${sample.capturedAt}`);
          await admin.rpc('server_record_movement_evidence', {
            p_user_id: user.id, p_batch_id: batchId, p_provider: provider,
            p_sample_digest: digest, p_captured_at: sample.capturedAt,
            p_latitude: sample.latitude, p_longitude: sample.longitude,
            p_accuracy_meters: sample.accuracyMeters,
            p_reported_speed_meters_per_second: sample.reportedSpeedMetersPerSecond ?? null,
            p_mocked: sample.mocked ?? false,
            p_status: acceptedCount > 0 ? 'accepted' : 'rejected',
            p_rejection_code: acceptedCount > 0 ? null : [...suspiciousCodes][0] ?? 'INVALID_GPS',
          });
        }
      } else {
        for (const activity of body.healthActivities ?? []) {
          const verified = validHealthActivity(activity, Date.now());
          if (!verified) { rejectedCount += 1; suspiciousCodes.add('INVALID_HEALTH_ACTIVITY'); continue; }
          const segmentHash = await hmacDigest(
            secret,
            `health-segment|${user.id}|${provider}|${activity.recordId}|${activity.startedAt}|${activity.endedAt}`,
          );
          const recorded = await admin.rpc('server_record_verified_segment', {
            p_user_id: user.id, p_batch_id: batchId, p_source: provider,
            p_segment_hash: segmentHash, p_activity_type: activity.activityType,
            p_distance_meters: verified.distance, p_started_at: activity.startedAt,
            p_ended_at: activity.endedAt, p_duration_seconds: verified.durationSeconds,
            p_average_speed_meters_per_second: verified.averageSpeed,
          });
          if (recorded.error) throw new Error('SEGMENT_FAILED');
          if (recorded.data?.[0]?.accepted) acceptedCount += 1;
          else { rejectedCount += 1; suspiciousCodes.add(recorded.data?.[0]?.rejection_code ?? 'OVERLAPPING_ACTIVITY'); }
        }
      }

      for (const code of suspiciousCodes) {
        await admin.rpc('server_record_suspicious_event', {
          p_user_id: user.id, p_event_code: String(code).toLowerCase(),
          p_risk_level: ['GPS_TELEPORT', 'SPEED_TOO_HIGH'].includes(code) ? 'high' : 'medium',
          p_sanitized_details: { provider, batchId: batchId },
        });
      }
      await admin.rpc('server_finish_distance_batch', {
        p_user_id: user.id, p_batch_id: batchId,
        p_accepted_count: acceptedCount, p_rejected_count: rejectedCount,
        p_rejection_code: [...suspiciousCodes][0] ?? null,
      });
    }

    const progress = await admin.rpc('server_get_verified_daily_progress', { p_user_id: user.id });
    if (progress.error) throw new Error('PROGRESS_FAILED');
    return jsonResponse({ requestId, progress: progress.data });
  } catch {
    return jsonResponse({
      error: 'DAILY_PROGRESS_UNAVAILABLE',
      message: 'We couldn’t update today’s walk. We’ll try again soon.',
      requestId,
    }, 500);
  }
});
