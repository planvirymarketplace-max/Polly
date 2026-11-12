# Polly — Supabase setup

## What lives here

| File | Purpose |
| --- | --- |
| `schema.sql` | Standalone Postgres DDL mirroring `prisma/schema.prisma` (same tables, columns, unique constraints — including the one-response-per-user-per-poll `unique ("pollId", "userId")`). |
| `rls.sql` | `ENABLE ROW LEVEL SECURITY` + policies for direct Supabase-client access. |

## The data-layer split (read this first)

- **Prisma is the app data layer.** The Next.js API routes talk to Postgres
  only through `src/lib/db.ts` (PrismaClient) using the pooled
  `DATABASE_URL`. Prisma connects with a privileged role, so RLS does not
  gate API queries — identity/authorization for the API is enforced
  server-side in `src/lib/polly/session.ts` (Supabase JWT validation).
- **RLS governs direct Supabase-client access only** (anon / authenticated
  roles with the anon key — e.g. a future mobile client querying Supabase
  directly). A member's rows are visible only when
  `users."supabaseId" = auth.uid()::text`; guest rows (`"supabaseId"` NULL)
  are never visible through RLS — guests act only through the API, which
  resolves them from the server-set httpOnly `polly_guest` cookie.
- **Sponsors** are linked to their Supabase Auth account via
  `sponsors."ownerSupabaseId"`; RLS lets a sponsor read/write only polls
  belonging to a sponsor row they own.

## Applying the schema — pick ONE path

### Path A (preferred): Prisma migrations
```bash
# .env must have DATABASE_URL (pooled, :6543) and DIRECT_URL (direct, :5432)
bunx prisma migrate dev --name init_postgres   # creates the migration from schema.prisma
bunx prisma db push                            # ...or push the schema without a migration
```
Then apply RLS only:
```bash
# Supabase SQL editor: paste supabase/rls.sql and run it.
# ...or with the Supabase CLI, from the repo root:
supabase db push --db-url "$DIRECT_URL" --file supabase/rls.sql
```

### Path B: SQL editor only (fresh project, no Prisma migrations)
1. Supabase Dashboard → SQL Editor → paste `supabase/schema.sql` → Run.
2. Same editor → paste `supabase/rls.sql` → Run.
3. Do **not** also run `prisma db push` / `migrate` against the same
   database — the tables already exist.

## Auth configuration (Supabase Dashboard → Authentication)

- Enable the providers Polly uses: **Google**, **Apple**, **Phone (OTP)**,
  and **Email (magic link)**. Add the web app's URL to Redirect URLs
  (e.g. `https://<lightsail-host>/auth/callback`) and the mobile deep link.
- Phone OTP needs a Twilio (or other SMS provider) account — see
  `.env.example`; without it, phone sign-in stays disabled and SSO +
  magic link still work.
- No trigger is needed to mirror `auth.users` into `public.users`: the API
  auto-provisions the Prisma `User` row (keyed by `supabaseId`) on the
  first authenticated request.

## Guest → member claim flow

1. Anonymous visitor votes → API creates a device-guest `User` row and
   sets the httpOnly `polly_guest` cookie. Rewards accrue as
   `unclaimedPoints` (plus sweepstakes entries / rev share).
2. Visitor signs up/in with Supabase Auth → client sends the JWT.
3. Client calls `POST /api/auth/claim-guest` → the server merges the
   guest balances, non-conflicting poll responses, and reward transactions
   into the member row, marks the guest row `claimedAt` (balances zeroed,
   so a double-claim is impossible), and clears the guest cookie.
