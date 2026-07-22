# Mission Trails dynamic relic system

This guide explains the production trust boundary and the local development flow.
Player screens use simple phrases such as **Hidden Relic Area**. Technical names
remain here because they help developers understand the security model.

## End-to-end flow

1. The map asks for foreground location permission and collects fresh GPS readings.
2. `relic-field` authenticates the Supabase user. Three accurate readings create a
   stable exploration zone based on a precision-5 geohash. That zone lasts for the
   configured zone lifetime, so walking across a geohash boundary cannot reroll relics.
3. Database server time selects a half-open 30-minute interval. An HMAC over the
   server secret, region, interval ID, and slot creates repeatable but unpredictable
   candidate choices. The secret never ships with Expo.
4. Production candidates must come from `private.safe_spawn_locations` rows already
   marked `verified`. Without enough trusted pedestrian locations, the server returns
   no areas. Mathematical candidates are allowed only for explicit local testing.
5. The server offsets every client marker from the exact point. The circle contains
   the relic but is not centered on it. The response includes only that offset area,
   expiry, and a locked/available flag.
6. The client refreshes after the server-provided interval. Clues expose only four
   strengths based on roughly 500 m, 200 m, and 75 m bands—never exact distance,
   bearing, or directions.
7. `relic-proximity` checks three ordered, recent readings with Haversine distance.
   All readings at 4.57 m accuracy or better use the 4.57 m target. Readings within
   the 12 m hard limit may use the 9 m fallback only when median accuracy is 9 m or
   better. The radius never grows beyond 9 m.
8. A successful reveal issues a one-time token that expires after 90 seconds. Three
   new readings are required for collection; reveal readings cannot be reused.
9. One PostgreSQL transaction locks the assignment and token, consumes the token,
   inserts the coordinate-free Vault row, awards XP once, and marks the assignment
   collected. Unique constraints make retries safe.
10. The client updates its offline Vault cache immediately, plays Relic Awakening
    with the registry artwork, and offers **View in Vault**. The Vault also syncs from
    the server whenever it gains focus.

## Daily distance and missions

`daily-progress` accepts individual GPS samples or walking/running health records,
never a client daily total. GPS segments are checked for ordering, freshness,
accuracy, speed, teleports, unsupported movement, replay hashes, overlap, and
unrealistic daily growth. Health and GPS time ranges cannot both earn distance.

- Rare unlocks at exactly 8,046.72 m (5 miles).
- Legendary unlocks at exactly 16,093.44 m (10 miles).
- All enabled required server missions unlock both tiers.
- Unlocks become active in the next server interval, preventing a movement-based reroll.

The database converts server time through the saved IANA timezone. Missing or invalid
timezones safely use UTC. Changing a timezone is rate-limited. A new local date creates
a new daily row, so yesterday's distance and mission shortcut do not carry over.

The mission screen's manual game checklist is presentation-only. It cannot grant
special relics. The required walking missions shown in the daily relic card are
calculated from server-accepted movement.

## Anti-cheat and privacy

- Driving, cycling, excessive speed, inaccurate GPS, mocked providers, teleports,
  stale/future readings, overlaps, and replayed batches do not add distance.
- Suspicious events are recorded for review; the player receives a friendly retry
  message and is not automatically banned.
- Exact relic points, exploration centers, raw movement evidence, challenges, and
  security events live in the non-exposed `private` schema with RLS enabled.
- Public Vault rows contain no coordinates. Authenticated users can read only their
  own rows and cannot insert them directly.
- Temporary GPS and proximity evidence has `retained_until` and indexed cleanup.
  `relic-proximity` runs cleanup opportunistically; production should also schedule it.
- Client sample IDs contain timestamps only, not encoded coordinates.
- Server errors return a request ID and safe wording, never caught database details.

## Environment

Expo may contain only:

```dotenv
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=
EXPO_PUBLIC_ENABLE_RELIC_TEST_MODE=false
```

The anon key is designed for public clients and remains restricted by Auth and RLS.
Never add the service-role key or HMAC secret to an `EXPO_PUBLIC_*` variable.

Copy `supabase/.env.example` to `supabase/.env.local`. Required Edge Function values:

```dotenv
RELIC_SPAWN_HMAC_SECRET=
RELIC_ALLOW_UNVERIFIED_SPAWNS=false
RELIC_HEALTH_SYNC_ENABLED=false
RELIC_ALLOW_DEVELOPMENT_DISTANCE_MOCK=false
RELIC_DEVELOPMENT_USER_IDS=
```

All thresholds and rate limits are listed in `supabase/.env.example`. Generate the
HMAC value with at least 32 random bytes and store it through Supabase secrets.

## HealthKit and Health Connect

The TypeScript adapter expects a native module named `MissionTrailsHealthBridge` with
`requestPermissions`, `getPermissionStatus`, and `readWalkingRunningActivities`.
The native bridge is not yet present, so health sync remains disabled and GPS is the
working distance source. Do not enable `RELIC_HEALTH_SYNC_ENABLED` until both platforms
are implemented and tested in development builds.

For iOS:

1. Add the HealthKit capability to the app target.
2. Add a clear `NSHealthShareUsageDescription`. Mission Trails needs read-only access;
   do not request write access.
3. Check `HKHealthStore.isHealthDataAvailable()`.
4. Request read access to workouts and `distanceWalkingRunning` only.
5. Return stable HealthKit sample/workout IDs, start/end times, activity type, distance
   in meters, and source name. Never return a manually typed daily total.

For Android:

1. Add the current AndroidX Health Connect client to the native app.
2. Declare and request read permission only for exercise sessions and distance records
   needed for walking/running.
3. Check Health Connect availability and current permissions before every sync.
4. Read stable record IDs and time-bounded `ExerciseSessionRecord`/`DistanceRecord`
   data. Provide a Settings path so permission can be changed later.

Health data from a compromised device is not cryptographic proof. Add Apple App
Attest/DeviceCheck and Play Integrity before treating health records as high-trust in
public release.

## Development mock

The distance mock is intentionally separated in `src/services/development-distance-provider.ts`.
It requires all of the following:

- a JavaScript development build (`__DEV__`),
- `RELIC_ALLOW_DEVELOPMENT_DISTANCE_MOCK=true`, and
- the authenticated development user's UUID in `RELIC_DEVELOPMENT_USER_IDS`.

Unverified spawn coordinates additionally require `RELIC_ALLOW_UNVERIFIED_SPAWNS=true`.
Never use production accounts in either development allow-list.

## Local commands

```bash
cp supabase/.env.example supabase/.env.local
supabase start
supabase db reset
npm run test:database
npm run test:relic-spawning
npm run test:daily-progress
npm run test:proximity
npm run test:relic-flow
npx tsc --noEmit
npm run typecheck:edge
npm run lint
supabase functions serve relic-field --env-file supabase/.env.local
supabase functions serve daily-progress --env-file supabase/.env.local
supabase functions serve relic-proximity --env-file supabase/.env.local
```

Never run `supabase db reset --linked` against a hosted project.

## Deployment commands (run only after review)

```bash
supabase link --project-ref YOUR_PROJECT_REF
supabase secrets set --env-file supabase/.env.production
supabase db push --dry-run
supabase db push
supabase functions deploy relic-field
supabase functions deploy daily-progress
supabase functions deploy relic-proximity
```

Before deploying, keep `RELIC_ALLOW_UNVERIFIED_SPAWNS=false`, keep all mock flags false,
load and audit trusted pedestrian locations, and verify migrations against a staging
copy. These commands are documentation only; Codex did not deploy or change production.

## Physical-device checklist

Run on a development build, not a simulator, for final GPS and health decisions.

### iPhone

- Grant **While Using the App** location and test denial followed by **Try Again**.
- Test open sky, trees, tall buildings, and a deliberately poor signal.
- Confirm three stationary readings allow collection after reveal.
- Turn Clue sounds/vibration on and off; enable Reduce Motion in Accessibility.
- Test HealthKit denial, limited history, approval, revoked access, and Apple Watch data.
- Disconnect the network after tapping Collect Relic, reconnect, and retry once.
- Confirm one Vault row and one XP award, then open the Vault from the animation.

### Android

- Test precise and approximate location permission, location services off, and retry.
- Repeat open-sky, poor-signal, stationary collection, offline retry, and duplicate tap.
- Test Health Connect missing/unavailable, permission denial, approval, and revoked access.
- Verify clue animation with Remove animations enabled and vibration disabled.
- Test at least one vendor with aggressive battery restrictions.

## Production-readiness limitations

- The repository currently declares Expo SDK 54 while project instructions target SDK
  56. Upgrade and regenerate the native project before adding SDK-56 native health work.
- The native HealthKit/Health Connect bridge is an interface only.
- No trusted safe-location importer is included. Production intentionally returns no
  relic areas until verified pedestrian/public POIs are loaded.
- Device attestation, scheduled retention cleanup, observability dashboards, and a
  human suspicious-event review process are still required before public release.
- Phone GPS cannot promise 15-foot accuracy everywhere. The bounded 9 m fallback is
  necessary, and some environments must show a wait/retry state rather than reveal.
