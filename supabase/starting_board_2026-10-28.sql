-- F2R: starting overall top 50 from stats, fading out as the first 10 fans vote.
-- Paste into Supabase -> SQL Editor -> Run. Safe to run more than once.
create or replace function public.compute_board(p_key text)
returns table(rank integer, player_id integer, points integer, firsts integer, votes integer)
language sql stable security definer set search_path = public as $$
  with e as (
    select l.user_id, x.pid, x.ord
    from lists l
    cross join lateral unnest(l.player_ids) with ordinality as x(pid, ord)
    join players p on p.id = x.pid
    where l.key = p_key and x.ord <= 50 and (p_key = 'overall' or (p_key = 'goat' and p.goat) or p.pos = p_key)
  ),
  -- Starting board (overall only): a top 50 from this season's stats (points + rebounds + assists + steals + blocks
  -- per game) that counts as (10 - real fans) fans. It fades a little with each fan and is gone at 10 fans.
  w as (
    select greatest(0, 10 - (select count(*) from lists where key = 'overall' and coalesce(array_length(player_ids,1),0) > 0))::int as n
  ),
  seed as (
    select p.id as pid, row_number() over (order by (p.pts + p.reb + p.ast + p.stl + p.blk) desc, p.id) as ord
    from players p
    where p_key = 'overall' and p.active and p.pts is not null and p.reb is not null and p.ast is not null
      and p.stl is not null and p.blk is not null and p.note !~* '^out for the season'
  ),
  s as (
    select pid, sum(pts)::int as points, sum(f)::int as firsts, sum(v)::int as votes from (
      select pid, (51 - ord)::int as pts, (ord = 1)::int as f, 1 as v from e
      union all
      select pid, ((51 - ord) * (select n from w))::int, 0, 0 from seed where ord <= 50 and (select n from w) > 0
    ) t group by pid
  )
  select (row_number() over (order by points desc, firsts desc, votes desc, pid))::int, pid, points, firsts, votes
  from s
$$;

revoke all on function public.compute_board(text) from public, anon, authenticated;
