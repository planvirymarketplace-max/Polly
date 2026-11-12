# Polly 🦜📊

**The social network for what you think — and why.**

TikTok owns dancing. Facebook owns friends. **Polly owns ideas.** A social feed driven
by local and national geo-political happenings, where everyday engagement puts users in
the line of sight of sponsors — stations, nonprofits, research firms, brands, advocacy
groups — who pay for real, weighted, publishable polling data. Users earn points,
sweepstakes entries, and revenue share for thought patterns they express anyway.

- **No community polls.** Polls are strictly sponsor-driven; the feed is strictly user-driven.
- **No advertisers.** Revenue comes from anyone who wants facts: media, science, legislative, lobbyists — agnostic.
- **Not a survey farm.** Never "100 surveys for $10" — engagement around common-sense ideas, transparently matched.

---

## Repository layout

```
polly/
├── src/                    # apps/web — Next.js 16 (App Router) — the runnable web app
│   ├── app/
│   │   ├── page.tsx        # the app: auth → phone-frame app OR sponsor dashboard
│   │   └── api/            # session, happenings, polls, vote, wallet, profile, sponsor
│   ├── components/polly/   # views: Feed, Polls, Rewards, Profile, Sponsor dashboard
│   └── lib/polly/          # core engines (mirrored to packages/core)
├── packages/core/          # @polly/core — shared domain logic for web + mobile
│   └── src/
│       ├── sampling.ts     # the business: 5 selection modes + post-stratification weighting
│       ├── rewards.ts      # tiered rewards: points, sweepstakes, rev share, perks
│       ├── pricing.ts      # sponsor price estimator vs traditional polling
│       └── types.ts        # DTOs shared across platforms
├── apps/mobile/            # Expo (React Native) app — same screens, same API
│   └── src/app/(tabs)/     # feed, polls, rewards, profile
├── prisma/schema.prisma    # data model (maps 1:1 to Supabase Postgres)
└── scripts/seed.ts         # demo dataset (fictional wires/sponsors by design)
```

**To make this a proper monorepo on GitHub:** move the root Next.js project into
`apps/web/` (it's self-contained — `package.json`, `src/`, `prisma/`), add a root
`package.json` with workspaces (`bun` / `pnpm` both work), and point
`@polly/core` imports at the workspace package. The web app's `src/lib/polly/*`
files are byte-identical to `packages/core/src/*` today, so the switch is mechanical.

## Run it

### Web (this repo, as-is)

```bash
bun install
bun run db:generate     # required — build does not generate the Prisma client
bun run db:push         # create the Supabase Postgres schema (needs real DATABASE_URL/DIRECT_URL)
bun scripts/seed.ts     # reference data only: the 9-topic taxonomy
bun scripts/ingest-rss.ts  # real happenings from verified public RSS feeds
bun run dev             # http://localhost:3000
```

### Mobile (apps/mobile)

```bash
cd apps/mobile
bun install            # or npm install
npx expo start         # scan QR with Expo Go — iOS/Android, no emulator needed
npx expo start --web   # or run it in a browser tab
```

Set `extra.apiUrl` in `app.json` to your deployed web app (Lightsail host or tunnel).

## The sampling engine (why results are sellable)

| Mode | What it does | Price/complete |
| --- | --- | --- |
| **Quota + UGC** | Invite by UGC interest graph, fill demographic quota cells, post-stratify to census targets. The publishable mode. | $1.50 |
| **UGC Match** | Pure topical match. Fast, passionate, skews loud — for engagement reads, not front-page numbers. | $1.00 |
| **Random Draw** | Uniform probability. Methodological benchmark, zero targeting. | $1.20 |
| **Sponsor Segment** | Sponsor defines geography × topic × demographics. Polly fills the order. | $2.25 |
| **Creator Audience** | The poll runs through a creator's channel to their followers — highest completion rates in the app. The creator takes revenue share on every complete. | $3.00 |

Weighting: each response carries `weight = census_target_share / sample_share` (rim-capped
0.25–4.0). Raw vs weighted percentages are shown side-by-side everywhere — users see the
methodology, sponsors get defensible numbers. Demo census targets are placeholders;
production uses per-metro ACS/Census tables.

Users always see **"Why you were selected"** on every poll. Non-invasive by design.

## Tiered rewards

| Tier | Points | Multiplier | Entries/poll | Rev share |
| --- | --- | --- | --- | --- |
| 🐣 Hatchling | 0+ | 1.0× | 1 | — |
| 🗣️ Voiced | 500+ | 1.25× | 2 | 1% |
| 🦜 Weathered | 2,500+ | 1.5× | 3 | 2% |
| 👑 Flock Leader | 10,000+ | 2.0× | 5 | 5% |

Guests accrue **held** points — claimable the moment they create an account.

## Production path

### 1. Supabase (backend)

The Prisma schema maps directly to Postgres:

1. Create a Supabase project; run the SQL equivalent of `prisma/schema.prisma`
   (tables: `User`, `Topic`, `UserInterest`, `Follow`, `Happening`, `Comment`, `Sponsor`,
   `Poll`, `PollOption`, `PollResponse`, `RewardTransaction`).
2. Auth: enable Apple, Google, phone OTP (Twilio via Supabase), magic link —
   the auth screen already presents all of them; replace the demo session
   resolver (`src/lib/polly/session.ts`) with `supabase.auth.getUser()`.
3. Row-level security: members read/write their own responses and wallet;
   sponsors read only their own polls. The `uid` query param disappears —
   identity comes from the JWT.
4. Swap `src/lib/db.ts` for the Supabase client (or keep Prisma against the
   Supabase Postgres URL — both work).

### 2. Lightsail (deployment)

```bash
# web app
bun run build && bun run start          # standalone server
# on Lightsail: Node 20+ container or instance, port 3000 behind the Lightsail
# load balancer; SQLite → Supabase Postgres before public launch
```

Mobile ships via **EAS**: `eas update` pushes JS-only changes with zero store
review; `eas build --platform ios/android` for native releases. Store notes:
register both developer accounts early — Apple reviews in 24–48h, new personal
Google accounts need the 14-day closed-test window before production.

### 3. Real data sources (replacing the demo seed)

- Happenings: Google Civic Information API, state legislature APIs (Open States),
  city council agenda scrapers, local news RSS.
- The interest graph grows from UGC (comments, votes) — already wired: posting a
  comment on a topic nudges affinity.

## Status

MVP build on branch `mvp-deploy` (see `MVP_HANDOVER.md`): Supabase Auth + Postgres
via Prisma, real RSS ingestion (no fictional seed — `scripts/seed.ts` seeds only
the 9-topic taxonomy), sponsor-only polls with all five sampling modes
(including Creator Audience via the follow graph), voting
with live post-stratification weighting, quota fill visualization, tiered
rewards with guest held-points + claim on signup, and a sponsor dashboard that
launches polls into the live member app instantly. **Not yet deployed** — it
needs a Supabase project and Lightsail access (blockers listed in
`MVP_HANDOVER.md` §8).

## Deploy (MVP)

```bash
cp .env.example .env.production   # fill in real Supabase values
./lightsail/deploy.sh             # builds, pushes, deploys to Lightsail
```

Full steps, env vars, and the Friday smoke test: `lightsail/ENV_CHECKLIST.md`.
