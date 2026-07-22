# Mission Trails relic backend

For the complete student-friendly architecture, security review checklist, deployment
commands, and physical-device test plan, see `../docs/relic-system.md`.

This directory contains the server-authoritative foundation for rotating relics.

## Trust boundary

- `public.relic_catalog` contains safe display metadata.
- `public.user_relic_collections` contains a user's coordinate-free inventory.
- Exact spawn points, verification attempts, challenges, eligibility, and XP ledger
  entries live in the non-exposed `private` schema.
- Only the authenticated `relic-field` Edge Function can invoke the service-role
  database routines that touch exact coordinates.

The app must never calculate production relic coordinates. A 30-minute window ID
is calculated from database server time. HMAC makes the same region/window stable
while preventing a user from predicting the next one without the server secret.

## Verified daily progress

`POST /functions/v1/daily-progress` is the only client entry point for daily
distance and rarity progress. It accepts incremental GPS samples or individual
HealthKit/Health Connect walking/running activities—not daily totals. The server
validates time order, server-relative age, accuracy, implied/reported speed,
teleports, activity type, overlaps, daily growth, replay hashes, and ownership.

Rare is earned at exactly 8,046.72 verified meters and Legendary at exactly
16,093.44 verified meters. Completing every server-required daily mission earns
both. Earned access becomes active at the next server-calculated 30-minute spawn
window, so a client cannot reroll the current field after crossing a threshold.

The applicable day comes from server time converted through the user's validated
IANA timezone. Missing or invalid zones use UTC. Zone changes are rate-limited to
once per 24 hours to reduce day-boundary manipulation.

GPS batches survive app restarts in AsyncStorage and are always revalidated after
offline delivery. Segment hashes and time-range overlap checks stop replay and
GPS/health double-counting. Exact GPS evidence is private and marked for deletion
after 24 hours; aggregate distance remains coordinate-free.

Health data is disabled by default. `RELIC_HEALTH_SYNC_ENABLED=true` should only
be enabled after the native `MissionTrailsHealthBridge` has been implemented in a
development build and platform permission text has been reviewed. On-device
health APIs do not provide cryptographic proof against a compromised client, so
production should additionally use app/device attestation before treating health
records as high-trust input.

The development mock requires all three controls: a development JS build,
`RELIC_ALLOW_DEVELOPMENT_DISTANCE_MOCK=true`, and the authenticated user's UUID in
`RELIC_DEVELOPMENT_USER_IDS`. Never include production accounts in that allow-list.

## Safe-location behavior

Production defaults to `RELIC_ALLOW_UNVERIFIED_SPAWNS=false`. The field endpoint
returns `SAFE_WALKING_LOCATION_DATA_UNAVAILABLE` until enough rows in
`private.safe_spawn_locations` have `validation_status = 'verified'`. A future map
data importer must reject water, highways, vehicle-only/restricted/private areas,
and inaccessible terrain before marking a location verified.

Unverified mathematical candidates exist only for explicit local/staging testing.
They are labeled `unverified` and are never described as safe.

## Field endpoint

`POST /functions/v1/relic-field` requires a Supabase user bearer token. When no
active zone exists, send at least three ordered readings captured 1–10 seconds
apart:

```json
{
  "provider": "gps",
  "locationReadings": [
    {
      "latitude": 37.0,
      "longitude": -122.0,
      "accuracyMeters": 8,
      "capturedAt": "2026-07-19T12:00:00.000Z",
      "mocked": false
    }
  ]
}
```

The example shows the shape; production sends three distinct readings. Once the
zone exists, an empty JSON body can retrieve the current field. The response has
offset mystery centers only. It never includes exact spawn coordinates or relic
identity until the authenticated proximity endpoint authorizes a reveal.

## Proximity reveal and collection

`POST /functions/v1/relic-proximity` supports two authenticated actions:

- `verify`: checks three consecutive fresh GPS readings against the private exact
  point. Safe responses contain only status and clue strength. A successful check
  returns revealed relic metadata and a deterministic 90-second one-time token.
- `collect`: requires three new readings plus that token. The database locks the
  assignment and challenge, rechecks eligibility/grace, consumes the token, adds
  the coordinate-free Vault row, inserts XP once, and completes the assignment in
  one transaction.

The 4.57 m target applies only when every reading reports accuracy at or below
4.57 m. The 9 m fallback applies only when every reading is within the 12 m hard
limit and median accuracy is no worse than 9 m. The server never expands beyond
9 m. Poorer readings return `improving_accuracy`.

Reveal samples cannot be reused as collection samples. Replayed request batches
are idempotent, and a retry after a lost successful response returns the existing
collection without issuing XP again. Exact coordinates never appear in mystery,
reveal, collection, Vault, error, or log responses.

Temporary proximity evidence is kept in `private` with a retention deadline. The
endpoint runs indexed cleanup opportunistically; `server_cleanup_expired_location_data`
can also be scheduled by Supabase Cron later.

## Local validation

```bash
cp supabase/.env.example supabase/.env.local
supabase start
supabase db reset
npm run test:database
npm run test:relic-spawning
npm run test:daily-progress
npm run test:proximity
supabase functions serve relic-field --env-file supabase/.env.local
supabase functions serve daily-progress --env-file supabase/.env.local
supabase functions serve relic-proximity --env-file supabase/.env.local
```

Do not use `supabase db reset --linked` against production.

## Geoapify trail discovery

`POST /functions/v1/trail-discovery` proxies Geoapify Places and Routing requests
for authenticated users. The Expo app never receives the Geoapify key. Configure it
as a server-only secret:

```bash
supabase secrets set GEOAPIFY_API_KEY=your_key_here
supabase functions deploy trail-discovery
```

For local serving, place `GEOAPIFY_API_KEY` in the ignored
`supabase/.env.local` file and pass that file with `--env-file`.
