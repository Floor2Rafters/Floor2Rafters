-- Roster update to match ESPN rosters, Oct 28, 2026. Paste into Supabase -> SQL Editor -> Run.
update public.players set team = 'DAL' where id = 42;  -- Walter Clayton Jr.
update public.players set team = 'NYK' where id = 162;  -- Dalton Knecht
update public.players set active = false where id = 35;  -- Kevin Porter Jr.
update public.players set active = false where id = 155;  -- Haywood Highsmith
update public.players set active = false where id = 156;  -- Jeremy Sochan
update public.players set active = false where id = 167;  -- Ochai Agbaji
update public.players set active = false where id = 276;  -- Christian Koloko
update public.players set active = false where id = 305;  -- Bruce Brown
update public.players set note = 'Out for the season (Achilles)' where id = 277;  -- Ariel Hukporti
