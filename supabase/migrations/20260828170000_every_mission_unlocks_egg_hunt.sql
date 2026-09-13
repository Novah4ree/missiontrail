begin;

-- Every completed permanent mission earns an Egg Hunt.
update private.progression_mission_catalog
set
  egg_hunt_reward = true,
  updated_at = clock_timestamp()
where egg_hunt_reward is distinct from true;


-- Backfill an Egg Hunt for any permanent missions
-- that were already completed before this rule changed.
insert into private.egg_hunt_unlocks (
  user_id,
  source_type,
  source_key,
  mission_number
)
select
  mission.user_id,
  'mission',
  'mission:' || mission.mission_number,
  mission.mission_number
from private.user_progression_missions as mission
where mission.status = 'completed'

on conflict (
  user_id,
  source_type,
  source_key
)
do nothing;

commit;
