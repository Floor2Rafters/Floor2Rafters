-- Floor 2 Rafters (F2R) database
-- Paste this whole file into Supabase → SQL Editor → Run. Then run seed_players.sql.
-- Safe to re-run: it creates what's missing and replaces the functions.

-- ---------- players ----------
-- Player ids are permanent. Fans' lists store these ids, so never reuse or renumber one.
-- To add a player, insert a new row with the next id. To retire one, set active = false.
create table if not exists public.players (
  id      integer primary key,
  name    text    not null,
  pos     text    not null check (pos in ('pg','sg','sf','pf','c')),
  team    text    not null default '',
  games   integer,
  pts     numeric(4,1),
  reb     numeric(4,1),
  ast     numeric(4,1),
  stl     numeric(3,1),
  blk     numeric(3,1),
  note    text    not null default '',   -- e.g. 'Rookie', 'Missed last season (injury)'
  active  boolean not null default true,
  sort    integer not null default 0     -- order players are shown in head-to-head (lower = earlier)
);
-- All-Time top 10 game (added Oct 2026; safe to re-run)
alter table public.players add column if not exists goat boolean not null default false;  -- in the all-time pool
alter table public.players add column if not exists career jsonb;                         -- career numbers + titles/MVPs
alter table public.players add column if not exists jersey text;                         -- jersey number shown on pick cards (from ESPN rosters)


-- ---------- each fan's lists ----------
-- One row per fan per list: 'pg','sg','sf','pf','c' (their position lists) and 'overall' (their top 50).
create table if not exists public.lists (
  user_id    uuid not null references auth.users(id) on delete cascade,
  key        text not null check (key in ('overall','pg','sg','sf','pf','c','goat')),
  player_ids integer[] not null default '{}',
  updated_at timestamptz not null default now(),
  primary key (user_id, key),
  constraint lists_max_50 check (coalesce(array_length(player_ids,1),0) <= 50)
);

-- A player can only be on a fan's list once. Anything saved with repeats (for example sent straight from the
-- browser console to rig the Fan Board) is cleaned on the way in: the first spot is kept, repeats and blanks dropped.
create or replace function public.lists_dedupe() returns trigger language plpgsql as $$
begin
  new.player_ids := coalesce((select array_agg(pid order by first_ord)
                                from (select pid, min(ord) as first_ord
                                        from unnest(new.player_ids) with ordinality as x(pid, ord)
                                       where pid is not null group by pid) s), '{}');
  return new;
end $$;
drop trigger if exists lists_dedupe on public.lists;
create trigger lists_dedupe before insert or update of player_ids on public.lists
  for each row execute function public.lists_dedupe();
update public.lists set player_ids = player_ids
 where cardinality(player_ids) <> (select count(distinct v) from unnest(player_ids) v);   -- clean any rows saved before this

-- ---------- each fan's private progress (XP, streak, who they've passed on) ----------
create table if not exists public.user_state (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- ---------- daily snapshots of the fan boards ----------
-- The Fan Boards are live: the app always shows the current count (get_board). Once a day the database saves a
-- copy here, so the app can show who moved over the last 7 days and each player's rank history.
create table if not exists public.rankings (
  week      date    not null,          -- the day of the snapshot (Eastern time); the column keeps its old name
  key       text    not null check (key in ('overall','pg','sg','sf','pf','c','goat')),
  rank      integer not null,
  player_id integer not null references public.players(id),
  points    integer not null,
  firsts    integer not null default 0, -- number of #1 votes
  votes     integer not null default 0, -- number of fans who listed this player
  primary key (week, key, rank)
);
create table if not exists public.weeks (
  week   date not null,
  key    text not null,
  voters integer not null,
  published_at timestamptz not null default now(),
  primary key (week, key)
);

-- People who can see the live (not yet official) board. Add yourself after you sign up:
--   insert into public.admins (user_id) select id from auth.users where email = 'you@example.com';
create table if not exists public.admins (user_id uuid primary key references auth.users(id) on delete cascade);

-- ---------- security: who can read/write what ----------
alter table public.players    enable row level security;
alter table public.lists      enable row level security;
alter table public.user_state enable row level security;
alter table public.rankings   enable row level security;
alter table public.weeks      enable row level security;
alter table public.admins     enable row level security;

drop policy if exists "players are public"      on public.players;
drop policy if exists "rankings are public"     on public.rankings;
drop policy if exists "weeks are public"        on public.weeks;
drop policy if exists "read own lists"          on public.lists;
drop policy if exists "write own lists"         on public.lists;
drop policy if exists "update own lists"        on public.lists;
drop policy if exists "delete own lists"        on public.lists;
drop policy if exists "read own state"          on public.user_state;
drop policy if exists "write own state"         on public.user_state;
drop policy if exists "update own state"        on public.user_state;

create policy "players are public"  on public.players  for select using (true);
create policy "rankings are public" on public.rankings for select using (true);
create policy "weeks are public"    on public.weeks    for select using (true);
-- Fans only ever see and change their own lists. Combined rankings are computed by the server.
create policy "read own lists"   on public.lists for select using (auth.uid() = user_id);
create policy "write own lists"  on public.lists for insert with check (auth.uid() = user_id);
create policy "update own lists" on public.lists for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "delete own lists" on public.lists for delete using (auth.uid() = user_id);
create policy "read own state"   on public.user_state for select using (auth.uid() = user_id);
create policy "write own state"  on public.user_state for insert with check (auth.uid() = user_id);
create policy "update own state" on public.user_state for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- The app saves a fan's settings as a patch: only what changed on that device. This merges it in, so a stale
-- device can't undo an email unsubscribe or roll back progress made on another device:
--   notify  merges switch by switch;  xp and best never go down;  streak + last only move forward in time.
create or replace function public.save_state(p_patch jsonb)
returns void language plpgsql security invoker set search_path = public as $$
declare cur jsonb; nxt jsonb; uid uuid := auth.uid();
begin
  if uid is null then raise exception 'not signed in'; end if;
  if p_patch is null or jsonb_typeof(p_patch) <> 'object' then return; end if;
  select data into cur from user_state where user_id = uid for update;
  cur := coalesce(cur, '{}'::jsonb);
  nxt := cur || (p_patch - 'notify' - 'xp' - 'best' - 'streak' - 'last');
  if jsonb_typeof(p_patch->'notify') = 'object' then
    nxt := jsonb_set(nxt, '{notify}', coalesce(cur->'notify', '{}'::jsonb) || (p_patch->'notify'));
  end if;
  if p_patch ? 'xp' then
    nxt := jsonb_set(nxt, '{xp}', to_jsonb(greatest(coalesce((cur->>'xp')::numeric, 0), coalesce((p_patch->>'xp')::numeric, 0))));
  end if;
  if p_patch ? 'best' then
    nxt := jsonb_set(nxt, '{best}', to_jsonb(greatest(coalesce((cur->>'best')::numeric, 0), coalesce((p_patch->>'best')::numeric, 0))));
  end if;
  if p_patch ? 'last' and coalesce(p_patch->>'last', '') >= coalesce(cur->>'last', '') then
    nxt := nxt || jsonb_build_object('last', p_patch->'last', 'streak', coalesce(p_patch->'streak', '0'::jsonb));
  end if;
  insert into user_state (user_id, data, updated_at) values (uid, nxt, now())
  on conflict (user_id) do update set data = excluded.data, updated_at = now();
end $$;
revoke all on function public.save_state(jsonb) from public, anon;
grant execute on function public.save_state(jsonb) to authenticated;
-- admins: no policies, so nobody can read or change it from the app.

-- ---------- ranking math ----------
-- A fan's #1 earns 50 points, #2 earns 49 ... #50 earns 1. Position boards count each fan's position list
-- (only players at that position); the overall board counts each fan's own overall top 50; the all-time board counts each fan's all-time list.
-- Until 10 fans have an overall list, the overall board also includes a starting top 50 from stats (see below).
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

create or replace function public.count_voters(p_key text)
returns integer language sql stable security definer set search_path = public as $$
  select count(*)::int from lists where key = p_key and coalesce(array_length(player_ids,1),0) > 0
$$;

-- The Monday (Eastern time) of the current week (used for weekly fan counts on the admin page).
create or replace function public.current_week()
returns date language sql stable as $$
  select date_trunc('week', (now() at time zone 'America/New_York'))::date
$$;
create or replace function public.today_et()
returns date language sql stable as $$
  select (now() at time zone 'America/New_York')::date
$$;

-- Save today's boards (runs every night, see bottom). Safe to run by hand: select snapshot_boards();
drop function if exists public.publish_week(date);
create or replace function public.snapshot_boards(p_day date default null)
returns void language plpgsql security definer set search_path = public as $$
declare k text; d date := coalesce(p_day, today_et());
begin
  foreach k in array array['overall','pg','sg','sf','pf','c','goat'] loop
    delete from rankings where week = d and key = k;
    insert into rankings (week, key, rank, player_id, points, firsts, votes)
      select d, k, b.rank, b.player_id, b.points, b.firsts, b.votes from compute_board(k) b;
    insert into weeks (week, key, voters) values (d, k, count_voters(k))
      on conflict (week, key) do update set voters = excluded.voters, published_at = now();
  end loop;
end $$;

-- What the app shows: the board right now, with each player's rank 7 days ago (or the oldest snapshot
-- if there's less than a week of history). Counted fresh on every call; fine for tens of thousands of fans.
-- (If it ever gets slow: cache compute_board in a table refreshed every few minutes.)
create or replace function public.get_board(p_key text)
returns table(week date, prev_week date, voters integer, rank integer, player_id integer, points integer, firsts integer, votes integer, prev_rank integer)
language sql stable security definer set search_path = public as $$
  with base as (
    select coalesce(
      (select max(w.week) from weeks w where w.key = p_key and w.week <= today_et() - 7),
      (select min(w.week) from weeks w where w.key = p_key and w.week < today_et())) as wk
  )
  select today_et(), (select wk from base), count_voters(p_key),
         b.rank, b.player_id, b.points, b.firsts, b.votes, pr.rank
  from compute_board(p_key) b
  left join rankings pr on pr.key = p_key and pr.week = (select wk from base) and pr.player_id = b.player_id
  order by b.rank
$$;

-- The old admin-only preview isn't needed now that every board is live.
drop function if exists public.get_live_board(text);

revoke all on function public.snapshot_boards(date) from public, anon, authenticated;
revoke all on function public.compute_board(text) from public, anon, authenticated;
revoke all on function public.count_voters(text) from public, anon, authenticated;
grant execute on function public.get_board(text) to anon, authenticated;

-- ---------- nightly snapshot ----------
-- Runs at 05:05 UTC every day = 1:05am Eastern in summer, 12:05am Eastern in winter.
-- Needs the pg_cron extension: Supabase → Database → Extensions → enable "pg_cron" first.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname in ('f2r-weekly-rankings', 'f2r-daily-snapshot');
    perform cron.schedule('f2r-daily-snapshot', '5 5 * * *', 'select public.snapshot_boards()');
  else
    raise notice 'pg_cron is not enabled yet. Enable it, then run this file again to schedule the nightly snapshot.';
  end if;
end $$;

-- ---------- feedback from the in-app form ----------
-- Anyone can send feedback (signed in or not). Nobody can read it from the app; read it in Supabase → Table Editor → feedback.
create table if not exists public.feedback (
  id         bigint generated always as identity primary key,
  user_id    uuid references auth.users(id) on delete set null,
  kind       text not null check (kind in ('bug','player','idea','other')),
  message    text not null check (char_length(message) between 1 and 2000),
  screen     text check (char_length(screen) <= 200),
  device     text check (char_length(device) <= 300),
  created_at timestamptz not null default now()
);
alter table public.feedback enable row level security;
drop policy if exists "anyone can send feedback" on public.feedback;
create policy "anyone can send feedback" on public.feedback for insert to anon, authenticated
  with check (user_id is null or user_id = auth.uid());

-- ---------- delete my account (Settings → Delete my account and lists) ----------
-- Removes the signed-in fan's sign-in, lists and progress. Their past votes stay in saved daily snapshots as anonymous totals.
create or replace function public.delete_my_account()
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  delete from auth.users where id = auth.uid();
  -- groups they were the last one in go too
  if to_regclass('public.groups') is not null then
    delete from public.groups g where not exists (select 1 from public.group_members m where m.group_id = g.id);
  end if;
end $$;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

-- ---------- upgrade an existing database for the All-Time game (safe to re-run) ----------
do $$ declare c record; begin
  for c in select conrelid::regclass as t, conname from pg_constraint
           where contype = 'c' and conrelid in ('public.lists'::regclass, 'public.rankings'::regclass)
             and pg_get_constraintdef(oid) like '%overall%' and pg_get_constraintdef(oid) not like '%goat%' loop
    execute format('alter table %s drop constraint %I', c.t, c.conname);
    execute format('alter table %s add constraint %I check (key in (''overall'',''pg'',''sg'',''sf'',''pf'',''c'',''goat''))', c.t, c.conname);
  end loop;
end $$;

-- ---------- sponsor spot numbers (views and taps per day) ----------
-- The app logs one "view" per visit per board and one "tap" per click on the sponsor. Read the totals in
-- Supabase → Table Editor → sponsor_stats, or: select day, kind, sum(n) from sponsor_stats group by 1,2 order by 1 desc;
create table if not exists public.sponsor_stats (
  day  date not null default (now() at time zone 'America/New_York')::date,
  kind text not null check (kind in ('view','tap')),
  key  text not null default 'overall',
  n    integer not null default 0,
  primary key (day, kind, key)
);
alter table public.sponsor_stats enable row level security;  -- no policies: only the function below can write it
create or replace function public.log_sponsor(p_kind text, p_key text default 'overall')
returns void language sql security definer set search_path = public as $$
  insert into sponsor_stats (day, kind, key, n)
  select (now() at time zone 'America/New_York')::date, p_kind, p_key, 1
  where p_kind in ('view','tap') and p_key in ('overall','pg','sg','sf','pf','c','goat')
  on conflict (day, kind, key) do update set n = sponsor_stats.n + 1
$$;
revoke all on function public.log_sponsor(text, text) from public;
grant execute on function public.log_sponsor(text, text) to anon, authenticated;

-- ---------- friend groups: private boards for a group chat ----------
-- A fan makes a group and shares its code or link; friends join with it. The group board is the same
-- 50-49-48… math as the Fan Board, counting only the group's members, and updates live (no Monday wait).
-- Members see each other's nickname and #1 pick on each list. Nobody else can see anything about a group.
-- The group's lead is whoever has been in it longest (the creator, until they leave).
-- Limits: anyone can join up to 10 groups. Free: start 1 group, up to 12 people. F2R Pro lead: start up to 10, up to 50 people each.
create table if not exists public.groups (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (char_length(btrim(name)) between 1 and 40),
  code       text not null unique,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create table if not exists public.group_members (
  group_id  uuid not null references public.groups(id) on delete cascade,
  user_id   uuid not null references auth.users(id) on delete cascade,
  nick      text not null check (char_length(btrim(nick)) between 1 and 24),
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);
create index if not exists group_members_user on public.group_members(user_id);
create unique index if not exists group_members_nick on public.group_members(group_id, lower(btrim(nick)));
alter table public.groups        enable row level security;  -- no policies: the app only reaches groups through the functions below
alter table public.group_members enable row level security;

create or replace function public.group_lead(p_group uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select user_id from group_members where group_id = p_group order by joined_at, user_id limit 1
$$;

create or replace function public.new_group_code()
returns text language plpgsql volatile set search_path = public as $$
declare a text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; c text;
begin
  loop
    c := '';
    for i in 1..6 loop c := c || substr(a, 1 + floor(random() * length(a))::int, 1); end loop;
    exit when not exists (select 1 from groups where code = c);
  end loop;
  return c;
end $$;

create or replace function public.create_group(p_name text, p_nick text)
returns table(id uuid, code text) language plpgsql security definer set search_path = public as $$
declare g groups;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if (select count(*) from group_members m where m.user_id = auth.uid()) >= 10 then raise exception 'You can be in up to 10 groups.'; end if;
  if to_regprocedure('public.is_pro(uuid)') is not null and not public.is_pro(auth.uid())
     and (select count(*) from groups gr where group_lead(gr.id) = auth.uid()) >= 1 then
    raise exception 'Free accounts can start 1 group. F2R Pro starts up to 10.'; end if;
  insert into groups (name, code, created_by) values (btrim(p_name), new_group_code(), auth.uid()) returning * into g;
  insert into group_members (group_id, user_id, nick) values (g.id, auth.uid(), btrim(p_nick));
  return query select g.id, g.code;
end $$;

create or replace function public.join_group(p_code text, p_nick text)
returns uuid language plpgsql security definer set search_path = public as $$
declare g uuid;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  select gr.id into g from groups gr where gr.code = upper(btrim(p_code));
  if g is null then raise exception 'No group with that code.'; end if;
  if exists (select 1 from group_members m where m.group_id = g and m.user_id = auth.uid()) then
    return g;
  end if;
  if exists (select 1 from group_members m where m.group_id = g and lower(btrim(m.nick)) = lower(btrim(p_nick))) then
    raise exception 'Someone in that group already goes by that name. Pick another.'; end if;
  if (select count(*) from group_members m where m.group_id = g) >= 50 then raise exception 'That group is full (50 people).'; end if;
  if to_regprocedure('public.is_pro(uuid)') is not null and not public.is_pro(group_lead(g))
     and (select count(*) from group_members m where m.group_id = g) >= 12 then
    raise exception 'That group is full. Free groups hold 12; the lead can go Pro for up to 50.'; end if;
  if (select count(*) from group_members m where m.user_id = auth.uid()) >= 10 then raise exception 'You can be in up to 10 groups.'; end if;
  insert into group_members (group_id, user_id, nick) values (g, auth.uid(), btrim(p_nick));
  return g;
end $$;

-- Leave a group. The last person out deletes it.
create or replace function public.leave_group(p_group uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  delete from group_members where group_id = p_group and user_id = auth.uid();
  delete from groups g where g.id = p_group and not exists (select 1 from group_members m where m.group_id = p_group);
end $$;

-- The lead can remove someone, and can get a new code (the old code and link stop working).
create or replace function public.remove_member(p_group uuid, p_nick text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if group_lead(p_group) is distinct from auth.uid() then raise exception 'Only the group lead can do that.'; end if;
  delete from group_members where group_id = p_group and nick = p_nick and user_id <> auth.uid();
end $$;
create or replace function public.new_code(p_group uuid)
returns text language plpgsql security definer set search_path = public as $$
declare c text;
begin
  if group_lead(p_group) is distinct from auth.uid() then raise exception 'Only the group lead can do that.'; end if;
  c := new_group_code(); update groups set code = c where id = p_group; return c;
end $$;

create or replace function public.my_groups()
returns table(id uuid, name text, code text, members integer, is_lead boolean, nick text)
language sql stable security definer set search_path = public as $$
  select g.id, g.name, g.code, (select count(*)::int from group_members x where x.group_id = g.id),
         group_lead(g.id) = auth.uid(), m.nick
  from groups g join group_members m on m.group_id = g.id and m.user_id = auth.uid()
  order by m.joined_at
$$;

-- The group's board, live. Members only.
create or replace function public.get_group_board(p_group uuid, p_key text)
returns table(rank integer, player_id integer, points integer, firsts integer, votes integer, voters integer)
language sql stable security definer set search_path = public as $$
  with mem as (select user_id from group_members where group_id = p_group),
  ok as (select 1 from mem where user_id = auth.uid()),
  e as (
    select l.user_id, x.pid, x.ord
    from lists l
    join mem on mem.user_id = l.user_id
    cross join lateral unnest(l.player_ids) with ordinality as x(pid, ord)
    join players p on p.id = x.pid
    where exists (select 1 from ok) and l.key = p_key and x.ord <= 50
      and (p_key = 'overall' or (p_key = 'goat' and p.goat) or p.pos = p_key)
  ), s as (
    select pid, sum(51 - ord)::int as points, count(*) filter (where ord = 1)::int as firsts, count(*)::int as votes from e group by pid
  )
  select (row_number() over (order by points desc, firsts desc, votes desc, pid))::int, pid, points, firsts, votes,
         (select count(distinct user_id)::int from e)
  from s
$$;

-- Who's in the group, and each person's #1 on this list. Members only.
create or replace function public.get_group_members(p_group uuid, p_key text)
returns table(nick text, is_me boolean, is_lead boolean, top1 integer, listed integer)
language sql stable security definer set search_path = public as $$
  select m.nick, m.user_id = auth.uid(), m.user_id = group_lead(p_group),
         l.player_ids[1], coalesce(array_length(l.player_ids, 1), 0)
  from group_members m
  left join lists l on l.user_id = m.user_id and l.key = p_key
  where m.group_id = p_group and exists (select 1 from group_members me where me.group_id = p_group and me.user_id = auth.uid())
  order by m.joined_at
$$;

revoke all on function public.group_lead(uuid) from public, anon, authenticated;
revoke all on function public.new_group_code() from public, anon, authenticated;
do $$ declare f text; begin
  foreach f in array array['create_group(text,text)','join_group(text,text)','leave_group(uuid)','remove_member(uuid,text)','new_code(uuid)',
                           'my_groups()','get_group_board(uuid,text)','get_group_members(uuid,text)'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;

-- ---------- notifications: Monday email + phone alerts ----------
-- Fans pick these in Settings (saved in user_state.data.notify; Monday and "your player moved" are on unless turned off,
-- the streak reminder is off unless turned on). The notify function (supabase/functions/notify) sends them:
--   Monday 9am Eastern: the weekly recap (email + phone): the fans' #1 now, and "your #1 moved 3+ spots this week" (its own phone alert)
--   Every evening 7pm Eastern: streak reminder (phone only, never email)
-- Each part stays off until its keys are added (see README, "Notifications").
create table if not exists public.push_tokens (
  token      text primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,
  platform   text not null check (platform in ('ios','android')),
  updated_at timestamptz not null default now()
);
create index if not exists push_tokens_user on public.push_tokens(user_id);
create table if not exists public.notify_log (
  user_id uuid not null references auth.users(id) on delete cascade,
  kind    text not null,
  ref     text not null,           -- the week or day it was for, so nobody gets the same alert twice
  sent_at timestamptz not null default now(),
  primary key (user_id, kind, ref)
);
-- Where the notify function lives and its secret (fill in once, see README). Nobody can read this from the app.
create table if not exists public.app_settings (key text primary key, value text not null);
alter table public.push_tokens  enable row level security;
alter table public.notify_log   enable row level security;
alter table public.app_settings enable row level security;

create or replace function public.save_push_token(p_token text, p_platform text)
returns void language sql security definer set search_path = public as $$
  insert into push_tokens (token, user_id, platform, updated_at)
  select p_token, auth.uid(), p_platform, now()
  where auth.uid() is not null and p_platform in ('ios','android') and char_length(p_token) between 20 and 4096
  on conflict (token) do update set user_id = excluded.user_id, platform = excluded.platform, updated_at = now()
$$;
create or replace function public.delete_push_token(p_token text)
returns void language sql security definer set search_path = public as $$
  delete from push_tokens where token = p_token and user_id = auth.uid()
$$;
revoke all on function public.save_push_token(text,text) from public, anon;
revoke all on function public.delete_push_token(text) from public, anon;
grant execute on function public.save_push_token(text,text) to authenticated;
grant execute on function public.delete_push_token(text) to authenticated;

create or replace function public.notify_on(d jsonb, k text)
returns boolean language sql immutable as $$
  select case when d #> array['notify', k] is null then k <> 'streak' else (d #>> array['notify', k])::boolean end
$$;

-- Who gets what this week. Only the notify function (service role) can call it.
create or replace function public.notify_targets(p_kind text)
returns table(user_id uuid, email text, name text, tokens jsonb, want_email boolean, want_push boolean, detail jsonb)
language sql stable security definer set search_path = public as $$
  with b as (select * from get_board('overall')),
  top1 as (select p.name, b.week, b.voters from b join players p on p.id = b.player_id where b.rank = 1),
  fans as (
    select u.id, u.email, coalesce(s.data, '{}'::jsonb) as d,
           (select l.player_ids[1] from lists l where l.user_id = u.id and l.key = 'overall') as my1,
           exists (select 1 from lists l where l.user_id = u.id and coalesce(array_length(l.player_ids,1),0) > 0) as has_list
    from auth.users u left join user_state s on s.user_id = u.id
  ),
  tok as (select t.user_id, jsonb_agg(jsonb_build_object('token', t.token, 'platform', t.platform)) as tokens from push_tokens t group by t.user_id)
  select f.id, f.email, nullif(f.d->>'name',''), coalesce(tok.tokens, '[]'::jsonb),
         p_kind = 'monday' and notify_on(f.d, 'monday'),
         true,
         case p_kind
           when 'monday' then jsonb_build_object(
             'week', (select week from top1), 'top', (select name from top1), 'voters', (select voters from top1),
             'board', notify_on(f.d, 'monday'),
             'moved', (select jsonb_build_object('name', p.name, 'rank', mb.rank, 'prev', mb.prev_rank)
                       from b mb join players p on p.id = mb.player_id
                       where notify_on(f.d, 'moved') and mb.player_id = f.my1 and mb.prev_rank is not null and abs(mb.prev_rank - mb.rank) >= 3))
           else jsonb_build_object('streak', coalesce((f.d->>'streak')::int, 0))
         end
  from fans f left join tok on tok.user_id = f.id
  where f.has_list
    and case p_kind
      when 'monday' then (select week from top1) is not null
        and (notify_on(f.d, 'monday') or notify_on(f.d, 'moved'))
        and not exists (select 1 from notify_log n where n.user_id = f.id and n.kind = 'monday' and n.ref = (select week from top1)::text)
      when 'streak' then notify_on(f.d, 'streak') and coalesce((f.d->>'streak')::int, 0) > 0
        and coalesce(f.d->>'last', '') = to_char((now() at time zone 'America/New_York') - interval '1 day', 'YYYY-MM-DD')  -- picked yesterday, not yet today; an ended streak gets no reminder
        and tok.tokens is not null
        and not exists (select 1 from notify_log n where n.user_id = f.id and n.kind = 'streak' and n.ref = to_char(now() at time zone 'America/New_York', 'YYYY-MM-DD'))
      else false end
$$;

-- Unsubscribe link in emails: turns one kind off for one fan.
create or replace function public.set_notify(p_user uuid, p_kind text, p_on boolean)
returns void language sql security definer set search_path = public as $$
  insert into user_state (user_id, data) values (p_user, jsonb_build_object('notify', jsonb_build_object(p_kind, p_on)))
  on conflict (user_id) do update set
    data = jsonb_set(coalesce(user_state.data, '{}'::jsonb), '{notify}', coalesce(user_state.data->'notify', '{}'::jsonb) || jsonb_build_object(p_kind, p_on)),
    updated_at = now()
$$;
revoke all on function public.notify_targets(text) from public, anon, authenticated;
revoke all on function public.set_notify(uuid,text,boolean) from public, anon, authenticated;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.notify_targets(text) to service_role;
    grant execute on function public.set_notify(uuid,text,boolean) to service_role;
  end if;
end $$;

-- Calls the notify function. Needs the pg_net extension (Supabase → Database → Extensions → pg_net)
-- and two rows in app_settings: notify_url and notify_secret (README, "Notifications").
create or replace function public.call_notify(p_kind text)
returns void language plpgsql security definer set search_path = public as $$
declare u text; s text;
begin
  select value into u from app_settings where key = 'notify_url';
  select value into s from app_settings where key = 'notify_secret';
  if u is null or s is null then raise notice 'Notifications not set up yet (app_settings notify_url / notify_secret).'; return; end if;
  perform net.http_post(url := u, body := jsonb_build_object('kind', p_kind),
                        headers := jsonb_build_object('Content-Type', 'application/json', 'x-notify-secret', s),
                        timeout_milliseconds := 60000);
end $$;
revoke all on function public.call_notify(text) from public, anon, authenticated;
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname in ('f2r-monday-notify', 'f2r-streak-notify');
    perform cron.schedule('f2r-monday-notify', '0 13 * * 1', 'select public.call_notify(''monday'')');   -- 9am Eastern in summer, 8am in winter
    perform cron.schedule('f2r-streak-notify', '0 23 * * *', 'select public.call_notify(''streak'')');   -- 7pm Eastern in summer, 6pm in winter
  end if;
end $$;

-- ---------- F2R Pro (paid tier, through Stripe) ----------
-- Fans pay on the website with a Stripe payment link; Stripe tells the stripe-webhook function, which fills this table.
-- Fans can read their own row (the app shows "You're Pro"); only the webhook writes it. Off until Stripe is set up (README, "F2R Pro").
create table if not exists public.pro (
  user_id             uuid primary key references auth.users(id) on delete cascade,
  status              text not null,          -- Stripe's subscription status: active, trialing, past_due, canceled…
  plan                text,                   -- month or year
  current_period_end  timestamptz,
  stripe_customer     text unique,
  stripe_subscription text,
  updated_at          timestamptz not null default now()
);
alter table public.pro enable row level security;
drop policy if exists "read own pro" on public.pro;
create policy "read own pro" on public.pro for select using (auth.uid() = user_id);
create or replace function public.is_pro(p_user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from pro where user_id = p_user and status in ('active','trialing','past_due')
                 and (current_period_end is null or current_period_end > now() - interval '3 days'))
$$;
revoke all on function public.is_pro(uuid) from public, anon;
grant execute on function public.is_pro(uuid) to authenticated;

-- ---------- "64% of fans took him too" (shown after each pick) ----------
-- Of the fans who have either player on that list (not counting you), how many rank each one higher.
-- Returns zeros until at least 20 fans have one of them, so nobody's single list can be worked out.
create or replace function public.h2h_agree(p_key text, p_a integer, p_b integer)
returns table(a_wins integer, b_wins integer)
language sql stable security definer set search_path = public as $$
  with s as (
    select array_position(player_ids, p_a) as ia, array_position(player_ids, p_b) as ib
    from lists
    where key = p_key and user_id is distinct from auth.uid() and (p_a = any(player_ids) or p_b = any(player_ids))
  ), c as (
    select count(*) filter (where ia is not null and (ib is null or ia < ib))::int as a,
           count(*) filter (where ib is not null and (ia is null or ib < ia))::int as b
    from s
  )
  select case when a + b >= 20 then a else 0 end, case when a + b >= 20 then b else 0 end from c
$$;
revoke all on function public.h2h_agree(text, integer, integer) from public;
grant execute on function public.h2h_agree(text, integer, integer) to anon, authenticated;

-- ---------- admin numbers (Me → Admin numbers, admins only) ----------
-- The app marks each signed-in fan as active once per week (Monday to Sunday, Eastern). That's what weekly fans
-- and "came back" are counted from. Nothing else is tracked.
create table if not exists public.activity (
  user_id uuid not null references auth.users(id) on delete cascade,
  week    date not null,
  primary key (user_id, week)
);
alter table public.activity enable row level security;  -- no policies: only the functions below touch it
create or replace function public.touch_activity()
returns void language sql security definer set search_path = public as $$
  insert into activity (user_id, week) select auth.uid(), current_week() where auth.uid() is not null
  on conflict do nothing
$$;
revoke all on function public.touch_activity() from public, anon;
grant execute on function public.touch_activity() to authenticated;

create or replace function public.am_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from admins where user_id = auth.uid())
$$;
grant execute on function public.am_admin() to authenticated;

create or replace function public.admin_stats()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare w date := current_week(); out jsonb;
begin
  if not exists (select 1 from admins where user_id = auth.uid()) then return null; end if;
  select jsonb_build_object(
    'week', w,
    'weeks', (select jsonb_agg(x order by x.week) from (
        select wk as week,
               (select count(*) from activity a where a.week = wk)::int as active,
               (select count(*) from activity a join activity b on b.user_id = a.user_id and b.week = wk - 7 where a.week = wk)::int as returning,
               (select count(*) from activity b where b.week = wk - 7)::int as prev,
               (select count(*) from auth.users u where u.created_at >= wk and u.created_at < wk + 7)::int as signups
        from generate_series(w - 49, w, interval '7 days') g(d), lateral (select g.d::date as wk) z) x),
    'fans', (select count(*) from auth.users)::int,
    'with_lists', (select count(distinct user_id) from lists where coalesce(array_length(player_ids,1),0) > 0)::int,
    'full_lists', (select count(*) from (select user_id from lists where key in ('pg','sg','sf','pf','c') and coalesce(array_length(player_ids,1),0) >= 10
                                          group by user_id having count(*) = 5) f)::int,
    'board_voters', count_voters('overall'),
    'groups', (select count(*) from groups)::int,
    'group_members', (select count(*) from group_members)::int,
    'pro', (select count(*) from pro where is_pro(user_id))::int,
    'alerts', (select count(distinct user_id) from push_tokens)::int,
    'sponsor_views', (select coalesce(sum(n),0) from sponsor_stats where kind = 'view' and day > current_date - 7)::int,
    'sponsor_taps', (select coalesce(sum(n),0) from sponsor_stats where kind = 'tap' and day > current_date - 7)::int
  ) into out;
  return out;
end $$;
revoke all on function public.admin_stats() from public, anon;
grant execute on function public.admin_stats() to authenticated;
