-- ─────────────────────────────────────────────────────────────────
-- Polly — Row Level Security (RLS) policies
-- ─────────────────────────────────────────────────────────────────
-- Apply AFTER supabase/schema.sql (or after `prisma db push`), in the
-- Supabase SQL editor or via `supabase db push`.
--
-- What RLS governs here: DIRECT Supabase-client access (anon /
-- authenticated roles using the anon key, e.g. a future mobile client
-- talking to Supabase directly). The Next.js app itself goes through
-- Prisma with the pooled DATABASE_URL role, which bypasses RLS — so
-- these policies do NOT gate the API routes. Identity and authorization
-- for the API are enforced server-side in src/lib/polly/session.ts
-- (JWT validation) and in each route.
--
-- Identity mapping: a Prisma users row belongs to a Supabase Auth user
-- when users."supabaseId" = auth.uid()::text. Guest rows ("supabaseId"
-- IS NULL) are never visible through RLS — guests only ever act through
-- the API, which resolves them from the server-set httpOnly cookie.
--
-- Table/column names match prisma/schema.prisma exactly (tables via
-- @@map, columns are Prisma's camelCase names, double-quoted).
-- ─────────────────────────────────────────────────────────────────

alter table users enable row level security;
alter table topics enable row level security;
alter table user_interests enable row level security;
alter table happenings enable row level security;
alter table comments enable row level security;
alter table sponsors enable row level security;
alter table polls enable row level security;
alter table poll_options enable row level security;
alter table poll_responses enable row level security;
alter table reward_transactions enable row level security;

-- ── users: members read/update only their own row ────────────────
drop policy if exists "Members read own user row" on users;
create policy "Members read own user row" on users
  for select to authenticated
  using ("supabaseId" = auth.uid()::text);

drop policy if exists "Members update own user row" on users;
create policy "Members update own user row" on users
  for update to authenticated
  using ("supabaseId" = auth.uid()::text)
  with check ("supabaseId" = auth.uid()::text);

drop policy if exists "Members insert own user row" on users;
create policy "Members insert own user row" on users
  for insert to authenticated
  with check ("supabaseId" = auth.uid()::text);

-- ── topics / happenings: public read (feed content) ──────────────
drop policy if exists "Anyone reads topics" on topics;
create policy "Anyone reads topics" on topics
  for select to anon, authenticated using (true);

drop policy if exists "Anyone reads happenings" on happenings;
create policy "Anyone reads happenings" on happenings
  for select to anon, authenticated using (true);

-- ── user_interests: members manage only their own ────────────────
drop policy if exists "Members read own interests" on user_interests;
create policy "Members read own interests" on user_interests
  for select to authenticated
  using (exists (
    select 1 from users u
    where u.id = user_interests."userId" and u."supabaseId" = auth.uid()::text
  ));

drop policy if exists "Members write own interests" on user_interests;
create policy "Members write own interests" on user_interests
  for all to authenticated
  using (exists (
    select 1 from users u
    where u.id = user_interests."userId" and u."supabaseId" = auth.uid()::text
  ))
  with check (exists (
    select 1 from users u
    where u.id = user_interests."userId" and u."supabaseId" = auth.uid()::text
  ));

-- ── comments: public read, members insert only as themselves ─────
drop policy if exists "Anyone reads comments" on comments;
create policy "Anyone reads comments" on comments
  for select to anon, authenticated using (true);

drop policy if exists "Members insert own comments" on comments;
create policy "Members insert own comments" on comments
  for insert to authenticated
  with check (exists (
    select 1 from users u
    where u.id = comments."userId" and u."supabaseId" = auth.uid()::text
  ));

-- ── sponsors: public read of name/kind; owners manage their own ──
drop policy if exists "Anyone reads sponsors" on sponsors;
create policy "Anyone reads sponsors" on sponsors
  for select to anon, authenticated using (true);

drop policy if exists "Sponsors manage own sponsor rows" on sponsors;
create policy "Sponsors manage own sponsor rows" on sponsors
  for all to authenticated
  using ("ownerSupabaseId" = auth.uid()::text)
  with check ("ownerSupabaseId" = auth.uid()::text);

-- ── polls: LIVE polls are public; sponsors see/manage only theirs ─
drop policy if exists "Anyone reads live polls" on polls;
create policy "Anyone reads live polls" on polls
  for select to anon, authenticated using (status = 'LIVE');

drop policy if exists "Sponsors read own polls" on polls;
create policy "Sponsors read own polls" on polls
  for select to authenticated
  using (exists (
    select 1 from sponsors s
    where s.id = polls."sponsorId" and s."ownerSupabaseId" = auth.uid()::text
  ));

drop policy if exists "Sponsors write own polls" on polls;
create policy "Sponsors write own polls" on polls
  for all to authenticated
  using (exists (
    select 1 from sponsors s
    where s.id = polls."sponsorId" and s."ownerSupabaseId" = auth.uid()::text
  ))
  with check (exists (
    select 1 from sponsors s
    where s.id = polls."sponsorId" and s."ownerSupabaseId" = auth.uid()::text
  ));

-- ── poll_options: readable with their poll ────────────────────────
drop policy if exists "Anyone reads options of live polls" on poll_options;
create policy "Anyone reads options of live polls" on poll_options
  for select to anon, authenticated
  using (exists (
    select 1 from polls p where p.id = poll_options."pollId" and p.status = 'LIVE'
  ));

drop policy if exists "Sponsors read options of own polls" on poll_options;
create policy "Sponsors read options of own polls" on poll_options
  for select to authenticated
  using (exists (
    select 1 from polls p
    join sponsors s on s.id = p."sponsorId"
    where p.id = poll_options."pollId" and s."ownerSupabaseId" = auth.uid()::text
  ));

-- ── poll_responses: members read/insert only their own ───────────
drop policy if exists "Members read own responses" on poll_responses;
create policy "Members read own responses" on poll_responses
  for select to authenticated
  using (exists (
    select 1 from users u
    where u.id = poll_responses."userId" and u."supabaseId" = auth.uid()::text
  ));

drop policy if exists "Members insert own responses" on poll_responses;
create policy "Members insert own responses" on poll_responses
  for insert to authenticated
  with check (exists (
    select 1 from users u
    where u.id = poll_responses."userId" and u."supabaseId" = auth.uid()::text
  ));
-- No UPDATE/DELETE policy: responses are immutable through direct
-- client access (one response per user per poll is enforced by the
-- unique ("pollId", "userId") constraint and by the API vote route).

-- ── reward_transactions: members read only their own ─────────────
drop policy if exists "Members read own transactions" on reward_transactions;
create policy "Members read own transactions" on reward_transactions
  for select to authenticated
  using (exists (
    select 1 from users u
    where u.id = reward_transactions."userId" and u."supabaseId" = auth.uid()::text
  ));
-- No INSERT/UPDATE/DELETE policy: transactions are written only by the
-- server (Prisma), never by direct client access.
