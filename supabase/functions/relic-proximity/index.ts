import { createClient } from 'npm:@supabase/supabase-js@2.106.2';

import {
  COLLECTION_ATTEMPTS_PER_MINUTE,
  isDevelopmentMockUser,
  MAX_MOVEMENT_SPEED_METERS_PER_SECOND,
  PROXIMITY_VERIFICATIONS_PER_MINUTE,
} from '../_shared/daily-config.ts';
import {
  bearingDegrees,
  distanceInFeet,
  distanceInFeetWhenNearby,
  verifyProximitySamples,
  type ProximitySample,
} from '../_shared/proximity-verification.ts';
import { hmacDigest } from '../_shared/spawn-algorithm.ts';
import {
  CLUE_DISTANCE_BANDS_METERS,
  FALLBACK_REVEAL_RADIUS_METERS,
  MAX_ACCEPTABLE_GPS_ACCURACY_METERS,
  NEARBY_SEARCH_RADIUS_FEET,
  REQUIRED_ACCURATE_READINGS,
  TARGET_REVEAL_RADIUS_METERS,
  requireSpawnHmacSecret,
} from '../_shared/spawn-config.ts';

type RequestBody = {
  action?: 'find' | 'verify' | 'collect';
  assignmentId?: string;
  samples?: ProximitySample[];
  deviceInstallationId?: string;
  challengeToken?: string;
};

type NearbyContext = {
  assignment_id: string;
  exact_latitude: number;
  exact_longitude: number;
};

type Context = {
  assignment_status: string;
  active: boolean;
  eligible: boolean;
  already_collected: boolean;
  exact_latitude: number;
  exact_longitude: number;
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function environment(name: string) {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing server environment: ${name}`);
  return value;
}

async function clientsFor(request: Request) {
  const authorization = request.headers.get('Authorization');
  if (!authorization?.startsWith('Bearer ')) return null;
  const url = environment('SUPABASE_URL');
  const userClient = createClient(url, environment('SUPABASE_ANON_KEY'), {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const auth = await userClient.auth.getUser();
  if (auth.error || !auth.data.user) return null;
  const admin = createClient(url, environment('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return { user: auth.data.user, admin };
}

function safeStatus(status: string, requestId: string, extra: Record<string, unknown> = {}) {
  const messages: Record<string, string> = {
    too_far: 'Keep exploring inside the Hidden Relic Area.',
    approaching: 'You’re getting closer!',
    improving_accuracy: 'Finding your location… Move to an open area.',
    revealed: 'You found a relic! Stay here for a moment.',
    expired: 'This relic moved! Look for a new Hidden Relic Area.',
    ineligible: 'Keep exploring to unlock special relics!',
    invalid_movement: 'We couldn’t verify this walk. Please try again.',
    already_collected: 'This relic is already in your Vault!',
  };
  return response({ requestId, status, message: messages[status] ?? 'We couldn’t check this relic. Please try again.', ...extra });
}

function cardinalDirection(bearing: number) {
  const directions = [
    'north', 'northeast', 'east', 'southeast',
    'south', 'southwest', 'west', 'northwest',
  ];
  return directions[Math.round(bearing / 45) % directions.length];
}

Deno.serve(async (request) => {
  const requestId = crypto.randomUUID();
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });
  if (request.method !== 'POST') return response({ error: 'METHOD_NOT_ALLOWED', requestId }, 405);

  try {
    const clients = await clientsFor(request);
    if (!clients) return response({ error: 'UNAUTHORIZED', requestId }, 401);
    const { user, admin } = clients;
    // Opportunistic indexed cleanup keeps temporary coordinate evidence within
    // its retention window even before a scheduled cron job is configured.
    await admin.rpc('server_cleanup_expired_location_data');
    const body = (await request.json().catch(() => ({}))) as RequestBody;
    if (
      !['find', 'verify', 'collect'].includes(body.action ?? '') ||
      (body.action !== 'find' && !body.assignmentId) || !body.deviceInstallationId ||
      body.deviceInstallationId.length > 160 || !Array.isArray(body.samples)
    ) return response({ error: 'INVALID_REQUEST', requestId }, 400);

    const rate = await admin.rpc('server_consume_field_rate_limit', {
      p_subject_key: `user:${user.id}`,
      p_endpoint: body.action === 'collect' ? 'relic-collection' : 'relic-proximity',
      p_limit: body.action === 'collect'
        ? COLLECTION_ATTEMPTS_PER_MINUTE
        : PROXIMITY_VERIFICATIONS_PER_MINUTE,
    });
    if (rate.error) throw new Error('RATE_CHECK_FAILED');
    if (!rate.data) return response({
      error: 'RATE_LIMITED', requestId,
      message: 'Please wait a moment, then try again.',
    }, 429);

    const usesMockedSample = body.samples.some((sample) => sample.mocked);
    if (usesMockedSample && !isDevelopmentMockUser(user.id)) {
      return safeStatus('invalid_movement', requestId);
    }

    let assignmentId = body.assignmentId;
    let nearbyDistanceFeet: number | null = null;
    let nearestDistanceFeet: number | null = null;
    let nearestBearingDegrees: number | null = null;

    if (body.action === 'find') {
      const nearbyContexts = await admin.rpc('server_list_nearby_relic_contexts', {
        p_user_id: user.id,
      });
      if (nearbyContexts.error) throw new Error('NEARBY_SEARCH_FAILED');

      const checked = ((nearbyContexts.data ?? []) as NearbyContext[]).map((candidate) => ({
        candidate,
        result: verifyProximitySamples(
          body.samples!,
          { latitude: candidate.exact_latitude, longitude: candidate.exact_longitude },
          {
            serverNow: new Date(),
            targetRadiusMeters: TARGET_REVEAL_RADIUS_METERS,
            fallbackRadiusMeters: FALLBACK_REVEAL_RADIUS_METERS,
            requiredReadings: REQUIRED_ACCURATE_READINGS,
            maxAccuracyMeters: MAX_ACCEPTABLE_GPS_ACCURACY_METERS,
            maxSpeedMetersPerSecond: MAX_MOVEMENT_SPEED_METERS_PER_SECOND,
            clueBandsMeters: CLUE_DISTANCE_BANDS_METERS,
          },
        ),
      }));

      if (checked.length === 0) {
        return safeStatus('too_far', requestId, {
          message: 'No relics are within 10 feet yet. Follow the Hidden Relic Areas!',
        });
      }

      const sampleProblem = checked.find(({ result }) =>
        result.status === 'invalid_movement' || result.status === 'improving_accuracy'
      );
      if (sampleProblem) return safeStatus(sampleProblem.result.status, requestId);

      checked.sort((left, right) =>
        (left.result.measuredDistanceMeters ?? Number.POSITIVE_INFINITY) -
        (right.result.measuredDistanceMeters ?? Number.POSITIVE_INFINITY)
      );
      const nearest = checked[0];
      nearestDistanceFeet = distanceInFeet(nearest.result.measuredDistanceMeters);
      nearestBearingDegrees = nearest.result.medianPoint
        ? bearingDegrees(nearest.result.medianPoint, {
            latitude: nearest.candidate.exact_latitude,
            longitude: nearest.candidate.exact_longitude,
          })
        : null;
      nearbyDistanceFeet = distanceInFeetWhenNearby(
        nearest.result.measuredDistanceMeters,
        NEARBY_SEARCH_RADIUS_FEET,
      );

      if (nearbyDistanceFeet === null) {
        const safeNearbyStatus = nearest.result.status === 'too_far' ? 'too_far' : 'approaching';
        const direction = nearestBearingDegrees === null
          ? null
          : cardinalDirection(nearestBearingDegrees);
        return safeStatus(safeNearbyStatus, requestId, {
          clueStrength: nearest.result.clueStrength,
          distanceFeet: nearestDistanceFeet,
          bearingDegrees: nearestBearingDegrees === null
            ? null
            : Math.round(nearestBearingDegrees),
          direction,
          message: nearestDistanceFeet === null || direction === null
            ? 'Keep exploring to find the closest relic!'
            : `The closest relic is about ${nearestDistanceFeet} ${nearestDistanceFeet === 1 ? 'foot' : 'feet'} away. Head ${direction}!`,
        });
      }
      assignmentId = nearest.candidate.assignment_id;
    }

    if (!assignmentId) return response({ error: 'INVALID_REQUEST', requestId }, 400);

    const contextResult = await admin.rpc('server_get_proximity_context', {
      p_user_id: user.id, p_assignment_id: assignmentId,
    });
    if (contextResult.error || !contextResult.data?.[0]) {
      return safeStatus('expired', requestId);
    }
    const context = contextResult.data[0] as Context;
    if (context.already_collected || context.assignment_status === 'collected') {
      return safeStatus('already_collected', requestId);
    }
    if (!context.active) return safeStatus('expired', requestId);
    if (!context.eligible) return safeStatus('ineligible', requestId);

    const result = verifyProximitySamples(
      body.samples,
      { latitude: context.exact_latitude, longitude: context.exact_longitude },
      {
        serverNow: new Date(),
        targetRadiusMeters: TARGET_REVEAL_RADIUS_METERS,
        fallbackRadiusMeters: FALLBACK_REVEAL_RADIUS_METERS,
        requiredReadings: REQUIRED_ACCURATE_READINGS,
        maxAccuracyMeters: MAX_ACCEPTABLE_GPS_ACCURACY_METERS,
        maxSpeedMetersPerSecond: MAX_MOVEMENT_SPEED_METERS_PER_SECOND,
        clueBandsMeters: CLUE_DISTANCE_BANDS_METERS,
      },
    );
    const secret = requireSpawnHmacSecret();
    const purpose = body.action === 'collect' ? 'collection' : 'reveal';
    const digest = await hmacDigest(
      secret,
      `proximity-samples|${user.id}|${assignmentId}|${JSON.stringify(body.samples)}`,
    );
    const attempt = await admin.rpc('server_record_proximity_attempt', {
      p_user_id: user.id, p_assignment_id: assignmentId,
      p_purpose: purpose, p_payload_digest: digest, p_result_status: result.status,
      p_reading_count: result.acceptedReadingCount,
      p_maximum_accuracy_meters: result.maximumAccuracyMeters,
      p_median_latitude: result.medianPoint?.latitude ?? null,
      p_median_longitude: result.medianPoint?.longitude ?? null,
      p_measured_distance_meters: result.measuredDistanceMeters,
      p_radius_used_meters: result.radiusUsedMeters,
      p_rejection_code: result.rejectionCode,
    });
    if (attempt.error || !attempt.data?.[0]) throw new Error('ATTEMPT_FAILED');

    if (result.status === 'revealed' && !attempt.data[0].accepted) {
      await admin.rpc('server_record_suspicious_event', {
        p_user_id: user.id, p_event_code: 'replayed_proximity_samples',
        p_risk_level: 'high', p_sanitized_details: { purpose, assignmentId },
        p_assignment_id: assignmentId,
      });
      return safeStatus('invalid_movement', requestId);
    }

    if (result.status !== 'revealed') {
      if (result.status === 'invalid_movement') {
        await admin.rpc('server_record_suspicious_event', {
          p_user_id: user.id,
          p_event_code: String(result.rejectionCode ?? 'invalid_movement').toLowerCase(),
          p_risk_level: ['GPS_TELEPORT', 'IMPOSSIBLE_SPEED', 'MOCKED_LOCATION'].includes(result.rejectionCode ?? '') ? 'high' : 'medium',
          p_sanitized_details: { purpose, assignmentId },
          p_assignment_id: assignmentId,
        });
      }
      return safeStatus(result.status, requestId, { clueStrength: result.clueStrength });
    }

    const attemptId = attempt.data[0].attempt_id as string;
    if (body.action === 'verify' || body.action === 'find') {
      const challengeToken = await hmacDigest(
        secret,
        `collection-challenge|${user.id}|${assignmentId}|${attemptId}|${body.deviceInstallationId}`,
      );
      const tokenHash = await hmacDigest(secret, `collection-token-hash|${challengeToken}`);
      const challenge = await admin.rpc('server_issue_collection_challenge', {
        p_user_id: user.id, p_assignment_id: assignmentId,
        p_reveal_attempt_id: attemptId,
        p_device_installation_id: body.deviceInstallationId,
        p_token_hash: tokenHash,
      });
      const metadata = await admin.rpc('server_get_revealed_relic_metadata', {
        p_user_id: user.id, p_assignment_id: assignmentId,
      });
      if (challenge.error || metadata.error || !challenge.data?.[0] || !metadata.data?.[0]) {
        throw new Error('REVEAL_FAILED');
      }
      if (challenge.data[0].status !== 'issued' || Date.parse(challenge.data[0].expires_at) <= Date.now()) {
        return response({
          requestId, status: 'expired',
          message: 'Time to find this relic again. Tap Find Hidden Relic.',
        });
      }
      return safeStatus('revealed', requestId, {
        assignmentId,
        distanceFeet: nearestDistanceFeet ?? nearbyDistanceFeet ?? undefined,
        bearingDegrees: nearestBearingDegrees === null
          ? undefined
          : Math.round(nearestBearingDegrees),
        direction: nearestBearingDegrees === null
          ? undefined
          : cardinalDirection(nearestBearingDegrees),
        message: nearbyDistanceFeet === null
          ? 'You found a relic! Stay here for a moment.'
          : `You found the closest relic! It’s about ${nearbyDistanceFeet} ${nearbyDistanceFeet === 1 ? 'foot' : 'feet'} away.`,
        clueStrength: 3,
        challenge: { token: challengeToken, expiresAt: challenge.data[0].expires_at },
        relic: {
          id: metadata.data[0].relic_id,
          name: metadata.data[0].display_name,
          rarity: metadata.data[0].rarity,
          xp: metadata.data[0].xp_reward,
        },
      });
    }

    if (!body.challengeToken) return response({
      error: 'CHALLENGE_REQUIRED', requestId,
      message: 'Tap Find Hidden Relic before collecting.',
    }, 409);
    const tokenHash = await hmacDigest(secret, `collection-token-hash|${body.challengeToken}`);
    const collection = await admin.rpc('server_complete_relic_collection', {
      p_user_id: user.id, p_assignment_id: assignmentId,
      p_challenge_token_hash: tokenHash, p_verification_attempt_id: attemptId,
    });
    if (collection.error) {
      const known = String(collection.error.message ?? '').toLowerCase();
      if (known.includes('expired')) return safeStatus('expired', requestId);
      if (known.includes('ineligible')) return safeStatus('ineligible', requestId);
      throw new Error('COLLECTION_FAILED');
    }
    const collected = collection.data?.[0];
    if (!collected) throw new Error('COLLECTION_FAILED');
    const metadata = await admin.rpc('server_get_revealed_relic_metadata', {
      p_user_id: user.id, p_assignment_id: assignmentId,
    });
    return response({
      requestId, status: collected.was_new_collection ? 'collected' : 'already_collected',
      message: collected.was_new_collection
        ? 'Added to your Vault!'
        : 'This relic is already in your Vault!',
      collection: {
        id: collected.collection_id, relicId: collected.relic_id,
        xpAwarded: collected.xp_awarded, collectedAt: collected.collected_at,
        wasNew: collected.was_new_collection,
      },
      relic: metadata.data?.[0] ? {
        id: metadata.data[0].relic_id, name: metadata.data[0].display_name,
        rarity: metadata.data[0].rarity, xp: metadata.data[0].xp_reward,
      } : undefined,
    });
  } catch {
    // Never echo database details: they may contain private identifiers or location context.
    return response({
      error: 'PROXIMITY_UNAVAILABLE', requestId,
      message: 'We couldn’t check your location. Please try again.',
    }, 500);
  }
});
