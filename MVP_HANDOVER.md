# Polly MVP — Handover

**Branch:** `mvp-deploy` (local only — **not pushed**, no push credentials confirmed)
**Date:** Thu 2026-11-12 (built through the day; deadline **Fri 2026-11-13 15:00 CST**)
**Owner:** Sunny
**Status: code-complete and build-verified. NOT deployed — there is no Supabase project, no AWS/Lightsail access, and no live database yet, so no end-to-end test against real infrastructure has been possible. Do not present this as deployed.**

## 1. What shipped

### Backend / Supabase (real, no demo)
- **Prisma SQLite → Postgres.** `prisma/schema.prisma` is now `provider = "postgresql"` with `directUrl = env("DIRECT_URL")`. All 10 models kept 1:1. Added: `User.supabaseId @unique`, `User.email @unique`, `User.guestToken @unique`, `User.claimedAt`, `Sponsor.ownerSupabaseId`. `PollResponse @@unique([pollId, userId])` intact — double-voting is impossible at the DB level, and the vote route also returns 409 first.
- **Supabase Auth replaces the demo session resolver.** `src/lib/polly/session.ts` now resolves identity **only** from a validated Supabase JWT (`Authorization: Bearer`, or Auth session cookies). The old `uid` query-param auth, the hardcoded `maya` member, and the `guest_demo` user are gone — verified by grep across `src/`, `scripts/`, `apps/mobile/src/`.
- **Guest mode (real).** Device guest rows keyed by a random token in a server-set httpOnly `polly_guest` cookie (never a query param/body). `POST /api/session` creates a guest, or **reuses the existing guest** if the cookie is already present (so held points can't be orphaned). Guest rewards land in `unclaimedPoints`.
- **Guest claim on signup.** `POST /api/auth/claim-guest` merges guest balances (points + unclaimed, sweepstakes, rev share, polls/comments), non-conflicting responses, and transactions into the member row in one transaction, recomputes tier, zeroes the guest, sets `claimedAt` (double-claim impossible), clears the cookie. Web and mobile both call it after sign-in.
- **RLS.** `supabase/schema.sql` (DDL mirroring Prisma) + `supabase/rls.sql` (48 statements, parsed cleanly with `pglast`): members read/write only their own rows/responses/transactions; LIVE polls/happenings/topics are public-read; sponsors read/write only polls of sponsors they own via `ownerSupabaseId`. Apply instructions in `supabase/README.md` — pick Prisma `db push` **or** SQL Editor, never both.
- **`.env.example`** (now committable — `.gitignore` has a `!.env.example` exception). Placeholders only, no real values anywhere in the repo.

### Feed — real ingestion, zero fictional data
- **Fictional seed deleted.** `scripts/seed.ts` now seeds **only the 9-topic taxonomy** (transit, housing, education, elections, economy, public-safety, energy-climate, healthcare, tech-privacy). No users, no sponsors, no happenings, no polls, no responses. The old 520 seeded responses / fictional wire services / synthetic respondents are gone.
- **Real RSS ingestion, no paid key.** `src/lib/polly/rss.ts` + `src/lib/polly/sources.ts` + `scripts/ingest-rss.ts` + `POST /api/happenings/ingest`. Stdlib `fetch` + regex/XML parsing, no new deps. Titles/summaries ingested **verbatim** (HTML stripped only), with outlet name + canonical link as attribution, deduped by title+source, topics by transparent keyword matching (unmatched → no topic, never guessed).
- **Verified live 2026-11-12** (fetched from this machine): NPR News, NPR Politics, The Texas Tribune, Chicago Sun-Times, Los Angeles Times, Star Tribune, govinfo Congressional Bills, Congress.gov Most-Viewed Bills. Example fetched today: NPR — “Colom wins Mississippi Senate race. And, White House warns Dems over future probes” (2026-11-12T12:15:48Z); Texas Tribune — “Execution set for Brownsville man in murder of three small children”. **Dropped after live verification failed** (do not re-add without re-verifying): AP News (connection refused), Reuters (HTTP 401 bot wall), White House briefing-room feed (404), Chicago Tribune / Denver Post (403).
- **Sponsor/admin happening creation.** `POST /api/happenings` requires JWT + an owned sponsor org, zod-validated, mandatory `sourceName` + `sourceUrl` attribution. Empty DB returns an empty list with an honest empty state — Polly never invents fallback headlines. Community users have **no** happening-creation endpoint; they comment.
- **Comments** (`POST /api/happenings/[id]/comments`) now use `resolveActingUser(req)`; posting still nudges the interest graph (+0.03 affinity, new interest at 0.3).

### Sponsor polls — the business model, sponsor-only
- **Sponsor onboarding (new — this was a gap: the seed creates no sponsors).** `POST /api/sponsor` creates a sponsor org owned by the authenticated user (`ownerSupabaseId` = JWT sub); `GET /api/sponsor` lists only your orgs. SponsorView has a “Register a sponsor org” form and the honest empty state “No sponsor org registered yet — register one to launch polls”.
- **Poll creation** (`POST /api/sponsor/polls`): JWT + ownership enforced server-side (401/403), zod validation (question 8–200 chars, 2–8 unique options, closesAt in the future, reward 20–500 pts, N 100–5000), all 4 sampling modes, status LIVE/DRAFT. **No community-poll endpoint exists anywhere** — verified.
- **Pricing estimator** (`/api/sponsor/estimate` + `src/lib/polly/pricing.ts`): QUOTA_UGC $1.50, UGC_MATCH $1.00, RANDOM $1.20, SPONSOR_SEGMENT $2.25 per complete. Verified: 500 QUOTA_UGC completes = $750 total vs $12,500–$25,000 traditional live-caller benchmark.
- **Sampling + weighting (untouched, verified by execution):** all 4 modes return a “Why you were selected” explanation with quota cell; post-stratification weight = census share / sample share, rim-capped 0.25–4.0. Test: a 90/10 skewed sample corrected from 90% raw → 68.5% weighted.
- **Rewards ledger (untouched logic, verified):** tiers Hatchling 0+ / Voiced 500+ (1.25×, 2 entries, 1% rev share) / Weathered 2,500+ (1.5×, 3, 2%) / Flock Leader 10,000+ (2×, 5, 5%). Verified: Voiced member completing a 50-pt, $1.50/complete poll earns 63 pts, 2 sweepstakes entries, 2¢ rev share; guest earns 50 held pts, 0 entries, 0¢.

### Auth — web + mobile (real code, needs config to run)
- **Web AuthGate rewritten:** Google/Apple SSO (`signInWithOAuth` → `/auth/callback` PKCE exchange, new route `src/app/auth/callback/route.ts`), Phone OTP (`signInWithOtp` → `verifyOtp` sms), Magic Link, Guest. Unconfigured methods are **disabled with “needs configuration”** — no fake success. `src/lib/supabase/browser.ts` (`@supabase/ssr` browser client, null when env unset) + `authFetch()` attaches the Bearer token. `src/components/polly/hooks.ts` sends **no `uid` anywhere**.
- **Mobile (Expo):** `apps/mobile/src/lib/api.ts` rewritten (Bearer token, typed DTOs, 401 → `AuthRequiredError`), new `src/lib/supabase.ts` + `src/lib/auth.tsx` (AuthProvider: OAuth, Phone OTP, Magic Link, guest via Supabase anonymous with local fallback) + `src/app/auth.tsx` sign-in screen. All four tabs render from the real API with honest error/empty/unauthenticated states; voting shows “Why you were selected”, weighted-vs-raw results, double-vote blocked in UI (and 409 server-side); rewards show held points + claim CTA + tier progress + transaction history. Two real gaps fixed along the way: missing `react-native-web` and expo-router's undeclared `query-string` dependency.
- **Demo copy removed everywhere:** no “Maya”, “Demo build”, “seeded data”, or “demo database” wording remains in `src/`, `scripts/`, or `apps/mobile/src/` (grep-verified).

### Deploy — ready to run once access exists
- **`Dockerfile`** (multi-stage, Node 22, bun, `prisma generate` before `next build`, standalone output, non-root user, port 3000, `HEALTHCHECK GET /api`). Build-time `DATABASE_URL` is a placeholder only — never a real credential.
- **`lightsail/`**: `deploy.sh` (single command: create service if needed → `docker build` → `push-container-image` → `create-container-service-deployment`; fails fast with a clear message if docker/aws/`.env.production` are missing), `containers.json`, `public-endpoint.json` (health check `GET /api`, 200), `ENV_CHECKLIST.md` (full step-by-step: Supabase project → Lightsail service → build sanity check → first real data → Friday 3pm smoke test).
- **Monorepo layout: NOT moved (deliberate).** README's aspirational move (root Next.js → `apps/web/` + root workspaces) was assessed and **deferred** — too risky inside the deadline window. The working layout is root = web app, `packages/core/` shared logic, `apps/mobile/` Expo. `bun install && bun run dev` and `cd apps/mobile && bun install && npx expo start --web` are the verified commands.

## 2. Verification results (all run 2026-11-12, branch `mvp-deploy`)

| Check | Result |
|---|---|
| `bun install` (root) | ✅ pass — 856 installs checked, no changes |
| `prisma validate` + `prisma generate` | ✅ pass — schema valid; client v6.19.2 generated. Note: in this sandbox the Prisma CLI hangs downloading engines through the egress proxy; it worked with pre-seeded engines + proxies unset + `PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING=1 CHECKPOINT_DISABLE=1`. Normal networks won't hit this. |
| `tsc --noEmit` (web root) | ✅ **exit 0, zero errors** (was 1 pre-existing error in sponsor polls — fixed) |
| `tsc --noEmit` (mobile) | ✅ exit 0, zero errors |
| `bun run build` | ✅ **exit 0** — compiled in 21.9s; all 17 routes present (`/`, `/api`, `/api/auth/claim-guest`, `/api/happenings`, `/api/happenings/[id]/comments`, `/api/happenings/ingest`, `/api/meta`, `/api/polls`, `/api/polls/[id]/results`, `/api/polls/[id]/vote`, `/api/profile`, `/api/session`, `/api/sponsor`, `/api/sponsor/estimate`, `/api/sponsor/polls`, `/api/wallet`, `/auth/callback`). Placeholder env only; build never connects to a DB. |
| Standalone server smoke test | ✅ `GET /` → 200 (11,698 bytes), `GET /api` → 200, `GET /api/session` (no auth, no DB) → 200 `{"authenticated":false,"member":null,"guest":null}`, `GET /api/happenings` (no DB) → 500 graceful, no crash. Server started from `.next/standalone/server.js` in 249ms. |
| Sampling / rewards / pricing logic (executed, no DB) | ✅ all 4 modes explain; weights rim-capped; 90% raw → 68.5% weighted; tiers at 0/500/2500/10000; awards correct (see §1) |
| RSS live fetch | ✅ NPR + Texas Tribune returned real items dated today (see §1) |
| `expo start --web` (mobile) | ✅ HTTP 200, bundle compiled (4,728,996 bytes, 793 modules). **Caveat:** HTTP + bundle only — no live-browser visual render was possible from this machine; do one visual pass with the web backend up. Without a backend the feed shows its honest error card, no crash. |
| `docker build` | ❌ **not run — no Docker in this sandbox.** Dockerfile reviewed only. First real build happens on the deploy machine. |
| End-to-end vs a real DB (seed → ingest → sponsor → poll → vote → double-vote 409 → guest claim) | ❌ **not run — no database exists yet.** No Supabase project, and no local Postgres in this sandbox (apt update was still running after 8+ min through the slow egress proxy; no `initdb`/`postgres` binary on the machine). This is the single most important remaining test and it needs Sunny's Supabase credentials. |
| Live OAuth / Phone OTP / Magic Link round trips | ❌ **not run — no Supabase project configured.** Code paths typecheck against `@supabase/ssr@0.12.7` / `@supabase/supabase-js@2.119.0`; the gate correctly shows “needs configuration” without env vars. |

## 3. How to run

### Web
```bash
bun install
cp .env.example .env            # fill in real values (see §4)
bun run db:generate             # required — build does not do this
bun run db:push                 # create the Supabase Postgres schema (or apply supabase/schema.sql + supabase/rls.sql in the SQL Editor — pick ONE path)
bun scripts/seed.ts             # 9 topics only
bun scripts/ingest-rss.ts       # real happenings from verified RSS feeds
bun scripts/ingest-rss.ts --dry-run   # fetch + parse only, writes nothing
bun run dev                     # http://localhost:3000
bun run build && bun run start  # production standalone server, port 3000
```

### Mobile
```bash
cd apps/mobile
bun install
npx expo start --web            # browser tab, http://localhost:8081
npx expo start                  # scan QR with Expo Go (iOS/Android)
```
Point at a backend with `EXPO_PUBLIC_API_URL=https://<host>` (or `extra.apiUrl` in `app.json`; default `http://localhost:3000`). Supabase config for mobile: `EXPO_PUBLIC_SUPABASE_URL` + `EXPO_PUBLIC_SUPABASE_ANON_KEY` in `apps/mobile/.env` (never committed). Details in `apps/mobile/README.md`.

## 4. Exact env vars needed

Copy `.env.example` → `.env` (local) / `.env.production` (deploy). **Placeholders only in the repo — never commit real values.**

| Variable | Required? | Source |
|---|---|---|
| `DATABASE_URL` | **Yes** | Supabase → Database → pooled connection (Supavisor, port 6543, `?pgbouncer=true`) — what the app uses at runtime |
| `DIRECT_URL` | **Yes** | Supabase → Database → direct connection (port 5432) — Prisma migrations / `db push` only |
| `NEXT_PUBLIC_SUPABASE_URL` | **Yes** | Supabase → Settings → API → Project URL (`https://<ref>.supabase.co`) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | **Yes** | Supabase → Settings → API → anon / publishable key |
| `SUPABASE_SERVICE_ROLE_KEY` | **Yes** | Supabase → Settings → API → service-role key. **Server-only, never `NEXT_PUBLIC_`** |
| `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` / `TWILIO_PHONE_NUMBER` | Optional | Only if Polly itself ever sends SMS directly. Phone OTP is configured in the Supabase Dashboard → Authentication → Phone; without it, phone sign-in stays disabled and SSO + magic link still work |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`, `APPLE_CLIENT_ID` / `APPLE_CLIENT_SECRET` | Optional in env | SSO is configured in the Supabase Dashboard → Authentication → Providers; no keys needed in the env file for that path |
| Mobile: `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY` | **Yes for mobile auth** | Same Supabase project values, in `apps/mobile/.env` |

## 5. Lightsail deploy steps (once AWS access exists)

Prerequisites: Docker, AWS CLI v2 + `lightsailctl` plugin, AWS credentials with Lightsail access, `.env.production` in the repo root with the real values from §4.

```bash
# 1. Sanity check the build locally first
cp .env.example .env.production   # fill in real values
bun run db:generate
DATABASE_URL=<redacted> \
  NEXT_TURBOPACK_EXPERIMENTAL_USE_SYSTEM_TLS_CERTS=1 bun run build

# 2. One-command deploy (creates the service if needed, builds, pushes, deploys)
./lightsail/deploy.sh
#    — or the manual equivalent:
#    docker build -t polly-web:latest .
#    aws lightsail push-container-image --service-name polly-web --label web --image polly-web:latest
#    aws lightsail create-container-service-deployment --service-name polly-web \
#      --containers file:///tmp/polly-containers.json \
#      --public-endpoint file://lightsail/public-endpoint.json

# 3. Take the public URL Lightsail prints, e.g.
#    https://polly-web.<random>.us-east-1.cs.amazonlightsail.com
#    and add it to Supabase → Authentication → URL Configuration → Redirect URLs:
#    https://<lightsail-host>/auth/callback
#    Then set mobile EXPO_PUBLIC_API_URL=https://<lightsail-host>

# 4. Watch the rollout
aws lightsail get-container-service-deployments --service-name polly-web
```

Full checklist with screenshots-described steps: `lightsail/ENV_CHECKLIST.md`.

## 6. Test checklist (run once Supabase exists — in this order)

- [ ] `bun run db:push` (or SQL Editor path) creates all 10 tables; `supabase/rls.sql` applied; spot-check RLS: a member's JWT can't read another member's wallet rows.
- [ ] `bun scripts/seed.ts` → “Seed complete: 9 topics.”
- [ ] `bun scripts/ingest-rss.ts` → per-feed inserted counts > 0; feed shows real headlines with outlet + link.
- [ ] `GET /api` → 200 on the deployed host.
- [ ] Guest opens feed → real happenings; guest votes → points held (`unclaimedPoints` > 0, wallet shows “held”).
- [ ] Magic-link sign-in works → `POST /api/auth/claim-guest` → held points move to balance; toast confirms.
- [ ] Google sign-in works (after provider enabled); Apple sign-in works (after Service ID configured).
- [ ] Phone OTP works (after Twilio configured in Supabase) — or confirm it stays honestly disabled.
- [ ] Sponsor: sign in → register org → compose poll in each of the 4 sampling modes → poll appears LIVE in the member app instantly.
- [ ] Vote on a poll → weighted results + “Why you were selected” shown; vote again → **409 “You already weighed in”**; verify only one `PollResponse` row exists for (pollId, userId).
- [ ] Quota fill: vote from different age/gender/metro profiles → quota visualization moves; weights change.
- [ ] Wallet: points, sweepstakes entries, rev share cents, tier progress all move; sponsor dashboard shows spend = responses × pricePerComplete.
- [ ] Mobile web (`EXPO_PUBLIC_API_URL=<host> npx expo start --web`) + Expo Go: same flows; visual pass of feed/polls/rewards/profile.
- [ ] `docker build -t polly-web:latest .` succeeds on the deploy machine (never run in this sandbox).

## 7. What was cut / deferred (post-MVP iteration list)

- **Monorepo move** (root Next.js → `apps/web/` + root workspaces) — assessed, deferred as too risky before the deadline. Layout stays root = web, `packages/core/`, `apps/mobile/`.
- **Per-metro ACS/Census targets** — weighting currently uses national adult 18+ demo census targets (`src/lib/polly/sampling.ts`, marked in-file). Production: load per-metro ACS tables into Supabase and wire `computeWeights` to them.
- **Sponsor billing / invoicing / payments** — pricing estimator and per-poll spend accounting exist; no Stripe/payment collection, no invoices, no rev-share payouts (ledger only — users accrue cents, no payout rail yet).
- **Push notifications** (poll invitations) — profile toggle is an honest non-functional preview; no push infra.
- **Admin / moderation tooling** — no admin console; sponsor orgs are self-registered, happenings are sponsor-created or RSS-ingested.
- **EAS builds + store listings** — mobile runs via Expo Go / web. Apple Developer + Google Play accounts, EAS project, and store review are all still ahead (new Google personal accounts need the 14-day closed-test window).
- **Google Civic Information API / Open States / council-agenda scrapers** — README's aspirational sources; MVP ships RSS only. Add behind env-gated keys later; never fake their data.
- **`typescript.ignoreBuildErrors: true` in `next.config.ts`** — pre-existing; `tsc --noEmit` is the real gate (currently 0 errors). Remove the ignore flag as a follow-up so `next build` enforces types too.
- **Sponsor analytics depth** (cross-tabs, exports) and **follower/friend graph features** — not in MVP scope.

## 8. BLOCKERS — what Sunny must provide, by when

| # | Blocker | Who provides | By when (to hit Fri 15:00 CST) | Why it gates |
|---|---|---|---|---|
| 1 | **Supabase project** — URL, anon key, service-role key, pooled `DATABASE_URL` (:6543), `DIRECT_URL` (:5432) | Sunny (create at supabase.com, ~15 min) | **Thu evening 2026-11-12 if possible; Fri 09:00 CST at the latest** | Without it: no database, no auth, no E2E test, no deploy. Everything else is ready and waiting on this. |
| 2 | **AWS / Lightsail access** (AWS credentials with Lightsail permissions) | Sunny | Fri 09:00 CST | Without it: `./lightsail/deploy.sh` can't run; deploy is a single command once this exists. |
| 3 | **Google OAuth client ID/secret + Apple Service ID** (configured in Supabase Dashboard → Authentication → Providers) | Sunny (Google Cloud Console + Apple Developer) | Fri 12:00 CST for full SSO; **can slip past MVP** — magic link + guest work without them, and the buttons honestly show “needs configuration” | SSO sign-in. |
| 4 | **Twilio account** (connected in Supabase Dashboard → Authentication → Phone) | Sunny | **Can slip past MVP** — phone OTP stays disabled; SSO + magic link cover sign-in | Phone OTP only. |
| 5 | **Domain / DNS** (optional for MVP) | Sunny | Post-MVP | Lightsail gives a working `*.cs.amazonlightsail.com` URL; a custom domain is cosmetic for the Friday test. |
| 6 | **Apple Developer + Google Play accounts, EAS account** | Sunny | Post-MVP | Store builds only; Expo Go + web cover Friday testing. |
| 7 | **Push `mvp-deploy` to GitHub?** | Sunny to confirm | Before deploy | Branch is local-only; no push credentials were available in this environment. `git push -u origin mvp-deploy` from a machine with access. |

## 9. Repo state

- 31 tracked files changed + 20 new files (51 paths total in `git status`), +2,130 / −964 lines on `mvp-deploy`.
- No secrets in the repo: no real keys, URLs, or credentials anywhere (grep-verified: `.env.example` is placeholders only; `DATABASE_URL` placeholders in docs are `placeholder`/`REPLACE_ME`).
- `node_modules/` and `.next/` are gitignored; `apps/mobile/bun.lock` is new (created by `bun install`).
- Known sandbox-only quirks (not product bugs): Prisma CLI engine downloads hang through this sandbox's egress proxy (pre-seeded engines + proxy-unset workaround documented in §2); `apt-get update` was extremely slow here, which is why no local Postgres E2E was possible.
