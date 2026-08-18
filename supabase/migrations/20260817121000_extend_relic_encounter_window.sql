begin;

-- =====================================================
-- EXTEND REVEALED RELIC CAMERA ENCOUNTER TO 10 MINUTES
-- =====================================================
--
-- Once a relic is revealed, give the player enough time
-- to use the camera encounter, allow GPS to stabilize,
-- interact with the relic, and securely claim it.
--
-- 600 seconds = 10 minutes.
--
-- No countdown will be shown to the player.
-- The app will later give one warning when 2 minutes remain.

-- Increase the server-config allowed range.
alter table private.relic_server_config
  drop constraint if exists
  relic_server_config_collection_challenge_ttl_seconds_check;

alter table private.relic_server_config
  add constraint
  relic_server_config_collection_challenge_ttl_seconds_check
  check (
    collection_challenge_ttl_seconds
    between 30 and 3600
  );

-- Set new relic encounter lifetime to 10 minutes.
update private.relic_server_config
set collection_challenge_ttl_seconds = 600
where singleton;

-- Extend any CURRENT live collection challenge too.
-- Expired challenges remain expired.
update private.one_time_collection_challenges
set expires_at = greatest(
  expires_at,
  clock_timestamp() + interval '10 minutes'
)
where purpose = 'collection'
  and status = 'issued'
  and expires_at > clock_timestamp();

commit;
