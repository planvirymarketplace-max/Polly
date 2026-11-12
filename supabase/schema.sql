-- ─────────────────────────────────────────────────────────────────
-- Polly — Supabase Postgres schema (DDL mirror of prisma/schema.prisma)
-- ─────────────────────────────────────────────────────────────────
-- Prisma is the source of truth for the app schema. This file is the
-- standalone-SQL equivalent for a fresh Supabase project: run it in the
-- Supabase SQL editor (or `supabase db push` via the CLI) INSTEAD of
-- `prisma db push` / `prisma migrate` — do not apply both to the same
-- database or the tables will already exist.
--
-- Column names are double-quoted camelCase to match Prisma exactly
-- (Prisma uses the field name as the column name unless @map is set).
-- IDs are TEXT: the app generates cuid() values, matching Prisma.
-- ─────────────────────────────────────────────────────────────────

create table if not exists users (
  id                    text primary key,
  "supabaseId"          text unique,      -- auth.users id (JWT sub); null for device guests
  email                 text unique,
  "guestToken"          text unique,      -- device-guest token (httpOnly cookie); null for members
  "claimedAt"           timestamptz,      -- guest row whose held rewards were claimed
  handle                text not null unique,
  "displayName"         text not null,
  "accountType"         text not null default 'MEMBER', -- MEMBER | GUEST
  metro                 text,
  "stateCode"           text,
  "ageBracket"          text,             -- 18-24 | 25-34 | 35-44 | 45-54 | 55-64 | 65+
  "genderBucket"        text,             -- F | M | NB | O
  points                integer not null default 0,
  "unclaimedPoints"     integer not null default 0, -- earned as guest, claimable after signup
  "sweepstakesEntries"  integer not null default 0,
  "revShareCents"       integer not null default 0,
  tier                  text not null default 'HATCHLING', -- HATCHLING | VOICED | WEATHERED | FLOCK_LEADER
  "followerCount"       integer not null default 0,
  "pollsAnswered"       integer not null default 0,
  "commentsPosted"      integer not null default 0,
  "createdAt"           timestamptz not null default now(),
  "updatedAt"           timestamptz not null default now()
);

create table if not exists topics (
  id    text primary key,
  slug  text not null unique,
  label text not null,
  emoji text
);

create table if not exists "user_interests" (
  "userId"  text not null references users (id) on delete cascade,
  "topicId" text not null references topics (id) on delete cascade,
  affinity double precision not null, -- 0-1 strength inferred from UGC engagement
  primary key ("userId", "topicId")
);

create table if not exists happenings (
  id             text primary key,
  title          text not null,
  summary        text not null,
  "sourceName"   text not null,
  metro          text, -- null = national
  "stateCode"    text,
  hotness        integer not null default 0,
  "commentCount" integer not null default 0,
  "topicId"      text references topics (id),
  "createdAt"    timestamptz not null default now()
);
create index if not exists happenings_topic_id_idx on happenings ("topicId");

create table if not exists comments (
  id            text primary key,
  body          text not null,
  "userId"      text not null references users (id) on delete cascade,
  "happeningId" text not null references happenings (id) on delete cascade,
  likes         integer not null default 0,
  "createdAt"   timestamptz not null default now()
);
create index if not exists comments_user_id_idx on comments ("userId");
create index if not exists comments_happening_id_idx on comments ("happeningId");

create table if not exists sponsors (
  id                text primary key,
  "ownerSupabaseId" text, -- Supabase auth.users id of the sponsor account
  name              text not null,
  kind              text not null, -- STATION | NONPROFIT | RESEARCH | BRAND | ADVOCACY
  blurb             text
);
create index if not exists sponsors_owner_supabase_id_idx on sponsors ("ownerSupabaseId");

create table if not exists polls (
  id                        text primary key,
  "sponsorId"               text not null references sponsors (id),
  question                  text not null,
  context                   text, -- why the sponsor is asking
  "topicId"                 text references topics (id),
  kind                      text not null default 'SINGLE_CHOICE', -- SINGLE_CHOICE | LIKERT
  "samplingMode"            text not null, -- QUOTA_UGC | UGC_MATCH | RANDOM | SPONSOR_SEGMENT
  "targetMetros"            text not null default 'NATIONAL', -- JSON array or "NATIONAL"
  "rewardPoints"            integer not null default 50,
  "estimatedN"              integer not null default 500,
  "pricePerCompleteCents"   integer not null default 120,
  status                    text not null default 'LIVE', -- LIVE | CLOSED | DRAFT
  "closesAt"                timestamptz not null,
  "createdAt"               timestamptz not null default now()
);
create index if not exists polls_sponsor_id_idx on polls ("sponsorId");
create index if not exists polls_topic_id_idx on polls ("topicId");
create index if not exists polls_status_idx on polls (status);

create table if not exists "poll_options" (
  id       text primary key,
  "pollId" text not null references polls (id) on delete cascade,
  label    text not null,
  position integer not null
);
create index if not exists poll_options_poll_id_idx on "poll_options" ("pollId");

create table if not exists "poll_responses" (
  id               text primary key,
  "pollId"         text not null references polls (id),
  "optionId"       text not null references "poll_options" (id),
  "userId"         text not null references users (id),
  "quotaCell"      text, -- "25-34|F|Chicago" — cell used for weighting
  weight           double precision not null default 1.0, -- post-stratification weight
  "rewardAwarded"  integer not null default 0,
  "createdAt"      timestamptz not null default now(),
  unique ("pollId", "userId") -- one response per user per poll
);
create index if not exists poll_responses_poll_id_idx on "poll_responses" ("pollId");
create index if not exists poll_responses_user_id_idx on "poll_responses" ("userId");
create index if not exists poll_responses_option_id_idx on "poll_responses" ("optionId");

create table if not exists "reward_transactions" (
  id          text primary key,
  "userId"    text not null references users (id),
  kind        text not null, -- POINTS | SWEEPSTAKES | REV_SHARE | PERK
  amount      integer not null, -- points, entries, or cents
  memo        text not null,
  "pollId"    text,
  "createdAt" timestamptz not null default now()
);
create index if not exists reward_transactions_user_id_idx on "reward_transactions" ("userId");
