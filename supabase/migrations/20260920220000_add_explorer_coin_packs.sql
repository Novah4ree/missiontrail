begin;

insert into private.iap_products (
  platform,
  product_id,
  coin_amount,
  is_active
)
values
  (
    'ios',
    'com.missiontrails.explorercoins.500',
    500,
    true
  ),
  (
    'ios',
    'com.missiontrails.explorercoins.1100',
    1100,
    true
  ),
  (
    'ios',
    'com.missiontrails.explorercoins.2400',
    2400,
    true
  ),
  (
    'ios',
    'com.missiontrails.explorercoins.6500',
    6500,
    true
  ),
  (
    'ios',
    'com.missiontrails.explorercoins.14000',
    14000,
    true
  )
on conflict (
  platform,
  product_id
)
do update set
  coin_amount = excluded.coin_amount,
  is_active = excluded.is_active,
  updated_at = clock_timestamp();

commit;
