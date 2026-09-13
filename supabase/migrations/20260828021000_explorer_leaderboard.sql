begin;

-- =========================================================
-- MISSION TRAILS
-- GLOBAL EXPLORER SCORE LEADERBOARD
-- =========================================================
--
-- Purpose:
-- Creates the real global leaderboard using the same
-- Explorer Score / XP ledger used by:
--
-- walking
-- missions
-- relics
-- companion care
-- Food Sort
-- eggs
-- trails
-- meetups
--
-- No separate fake leaderboard score is created.
-- =========================================================


create or replace function
public.server_get_explorer_leaderboard(
  p_limit integer default 50
)
returns table (
  rank_position bigint,
  user_id uuid,
  display_name text,
  username text,
  avatar_url text,
  explorer_score bigint,
  is_current_user boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid :=
    auth.uid();

  v_limit integer :=
    greatest(
      1,
      least(
        coalesce(
          p_limit,
          50
        ),
        100
      )
    );
begin

  if v_user_id is null then
    return;
  end if;


  return query

  with explorer_totals as (
    select
      ledger.user_id,

      greatest(
        0,
        coalesce(
          sum(
            ledger.xp_delta
          ),
          0
        )
      )::bigint
        as explorer_score

    from private.xp_ledger
      as ledger

    group by
      ledger.user_id
  ),


  ranked_explorers as (
    select
      totals.user_id,

      totals.explorer_score,

      dense_rank()
      over (
        order by
          totals.explorer_score
          desc
      )::bigint
        as rank_position

    from explorer_totals
      as totals
  )


  select
    ranked.rank_position,

    ranked.user_id,

    coalesce(
      nullif(
        trim(
          profile.display_name
        ),
        ''
      ),

      nullif(
        trim(
          profile.username
        ),
        ''
      ),

      'Explorer'
    )::text
      as display_name,


    coalesce(
      nullif(
        trim(
          profile.username
        ),
        ''
      ),

      'explorer'
    )::text
      as username,


    profile.avatar_url::text,


    ranked.explorer_score,


    (
      ranked.user_id =
      v_user_id
    )::boolean
      as is_current_user


  from ranked_explorers
    as ranked


  left join public.profiles
    as profile

    on profile.id =
      ranked.user_id


  where
    ranked.rank_position <=
      v_limit

    -- Purpose:
    -- Even if the signed-in player is outside
    -- the Top 50, still return their own rank.
    or ranked.user_id =
      v_user_id


  order by
    ranked.rank_position asc,

    ranked.user_id asc;

end;
$$;


comment on function
public.server_get_explorer_leaderboard(
  integer
)
is
  'Returns ranked Mission Trails explorers using lifetime Explorer Score.';


-- =========================================================
-- SECURITY
-- =========================================================
--
-- Signed-in players may READ the leaderboard.
--
-- They still cannot directly edit XP.
-- =========================================================

revoke all
on function
public.server_get_explorer_leaderboard(
  integer
)
from public, anon, authenticated;


grant execute
on function
public.server_get_explorer_leaderboard(
  integer
)
to authenticated;


commit;
