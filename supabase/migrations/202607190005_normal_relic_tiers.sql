begin;

-- The first catalog only had Rare, Epic, and Legendary artwork. The spawning
-- algorithm already rolled Common and Uncommon, but had to fall back to Epic.
-- These existing relics now fill the everyday tiers without adding fake art.
update public.relic_catalog as relic
set rarity = tier.rarity,
    xp_reward = tier.xp_reward,
    updated_at = clock_timestamp()
from (values
  ('ancient-mystical-coin', 'common', 20),
  ('fossil-fang', 'common', 20),
  ('dreamcap-spore', 'common', 20),
  ('titan-stone', 'common', 20),
  ('mystical-oracle-eye', 'uncommon', 35),
  ('levitating-armored-seed', 'uncommon', 35),
  ('elegant-glass-flower', 'uncommon', 35),
  ('sentinel-crest', 'uncommon', 35)
) as tier(relic_id, rarity, xp_reward)
where relic.relic_id = tier.relic_id;

update private.daily_mission_definitions
set title = case mission_id
  when 'verified-walk-one-mile' then 'Walk or run 1 mile'
  when 'verified-active-twenty-minutes' then 'Explore on foot for 20 minutes'
  when 'verified-movement-session' then 'Finish one walking or running trip'
  else title
end,
updated_at = clock_timestamp()
where mission_id in (
  'verified-walk-one-mile',
  'verified-active-twenty-minutes',
  'verified-movement-session'
);

commit;
