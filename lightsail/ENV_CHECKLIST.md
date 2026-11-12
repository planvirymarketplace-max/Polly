# Polly — Lightsail deploy checklist

Target: a deployable, testable MVP by **Friday, Nov 13, 2026, 3:00 p.m. CST**.
Web app: Next.js 16 standalone container (see `Dockerfile` at the repo root).
It listens on port **3000**; health check is `GET /api` (returns 200).

> No real secrets belong in this folder. Every value below marked
> `REPLACE_ME` comes from the Supabase dashboard or AWS — copy it into
> your local `.env.production` (never committed) and into the Lightsail
> container environment. The `Dockerfile` never receives real keys as
> build args.

## 0. What is already done (verified 2026-11-12)

- `mvp-deploy` branch: real Supabase Auth wiring, Prisma → Supabase
  Postgres, RSS feed ingestion from verified public feeds, sponsor-only
  polls with the 4 sampling modes, rewards ledger, sponsor dashboard.
- Fictional demo seed removed — `scripts/seed.ts` now seeds only the
  9-topic taxonomy. Real feed content comes from `scripts/ingest-rss.ts`.
- `supabase/schema.sql` + `supabase/rls.sql` ready to apply.
- `Dockerfile` builds the standalone image. **Build note:** `bun run build`
  does NOT generate the Prisma client — run `bun run db:generate` first
  (see step 3). The build needs a `DATABASE_URL` to *exist*; it never
  connects at build time, so a placeholder is fine for the build step.

## 1. Supabase project (~15 min, the hard gate)

1. Create a project at supabase.com (pick the region closest to users;
   note the project ref, e.g. `abcdefghijklm`).
2. Apply the schema — pick ONE path (see `supabase/README.md`):
   - **Path A (preferred):** in the repo root, with `.env` holding the
     real `DATABASE_URL` (pooled, port 6543) and `DIRECT_URL` (port 5432):
     `bun run db:generate && bunx prisma db push`, then paste
     `supabase/rls.sql` into the Supabase SQL Editor and run it.
   - **Path B:** SQL Editor → paste `supabase/schema.sql` → Run; then
     paste `supabase/rls.sql` → Run. Do NOT also run `prisma db push`.
3. Copy from **Project Settings → API**: the project URL
   (`https://<ref>.supabase.co`), the **anon / publishable key**, and the
   **service-role key** (server-only, never `NEXT_PUBLIC_`).
4. Copy from **Project Settings → Database**: the pooled connection
   string (Supavisor, port 6543) → `DATABASE_URL`; the direct string
   (port 5432) → `DIRECT_URL`.
5. **Authentication → Providers:** enable **Google**, **Apple**, **Phone**,
   and **Email (magic link)**. Google/Apple client IDs and secrets are
   configured in the Supabase dashboard — no keys go in the env file
   for them. Phone OTP needs an SMS provider (Twilio) configured in the
   dashboard; without it, phone sign-in stays disabled and SSO + magic
   link still work.
6. **Authentication → URL Configuration → Redirect URLs:** add
   `https://<lightsail-host>/auth/callback` (and the mobile deep link)
   once you have the Lightsail host from step 2.

## 2. Lightsail container service (~10 min)

```bash
# Needs: AWS CLI + the lightsailctl plugin (for push-container-image).
aws lightsail create-container-service \
  --service-name polly-web --power small --scale 1
```

Or use the ready-made script (builds, pushes, deploys in one go):

```bash
./lightsail/deploy.sh            # uses .env.production in the repo root
```

What the script does, step by step:

```bash
docker build -t polly-web:latest .
aws lightsail push-container-image \
  --service-name polly-web --label web --image polly-web:latest
aws lightsail create-container-service-deployment \
  --service-name polly-web \
  --containers file://lightsail/containers.json \
  --public-endpoint file://lightsail/public-endpoint.json
```

- `lightsail/containers.json` — the `web` container: image
  `:polly-web.web.latest`, port `3000` → `HTTP`, environment from
  `.env.production`. **Edit the `REPLACE_ME` values before deploying.**
- `lightsail/public-endpoint.json` — container `web`, port `3000`,
  health check `GET /api`, success code `200` (matches the
  `HEALTHCHECK` in the `Dockerfile`).
- After deploy, Lightsail prints a public URL like
  `https://polly-web.<random>.us-east-1.cs.amazonlightsail.com` — that
  is `<lightsail-host>`. Add it to the Supabase redirect URLs (step 1.6)
  and set mobile `EXPO_PUBLIC_API_URL=https://<lightsail-host>`.

## 3. Local build sanity check (before pushing the image)

```bash
cp .env.example .env.production   # then fill in the real values
bun run db:generate               # required — build does not do this
DATABASE_URL=postgresql://postgres:placeholder@aws-0-us-east-1.pooler.supabase.com:6543/postgres \
  NEXT_TURBOPACK_EXPERIMENTAL_USE_SYSTEM_TLS_CERTS=1 bun run build
```

## 4. Environment variables (set on the Lightsail container)

| Variable | Where it comes from |
| --- | --- |
| `DATABASE_URL` | Supabase → Database → pooled connection (port 6543) |
| `DIRECT_URL` | Supabase → Database → direct connection (port 5432) |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Settings → API → anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API → service-role key |
| `TWILIO_*` | Optional — only if Polly itself ever sends SMS directly; phone OTP is configured in the Supabase dashboard |
| `GOOGLE_*` / `APPLE_*` | Optional in env — SSO is configured in the Supabase dashboard |

## 5. First real data (no mock data, ever)

```bash
bun scripts/seed.ts          # 9 topics only — no users, sponsors, polls
bun scripts/ingest-rss.ts    # pulls verbatim headlines from the verified
                             # feeds in src/lib/polly/sources.ts
```

## 6. Friday 3 p.m. smoke test (run against the live URL)

1. `GET https://<lightsail-host>/api` → 200.
2. Guest opens the feed — real RSS happenings with outlet attribution.
3. Magic-link sign-in works; guest points claim on signup.
4. Sponsor creates a poll → it appears live in the member app.
5. Vote in each sampling mode; results + "Why you were selected" show.
6. Rewards: points land in the wallet; tier shows (Hatchling → Flock Leader).
7. Mobile: `EXPO_PUBLIC_API_URL=https://<lightsail-host> npx expo start --web`.

## Still open / needs Sunny

- [ ] Supabase project URL, anon key, service-role key, `DATABASE_URL`/`DIRECT_URL`
- [ ] AWS / Lightsail access (or run `./lightsail/deploy.sh` with it)
- [ ] Twilio account if phone OTP is required for the MVP (else SSO + magic link only)
- [ ] Push `mvp-deploy` to GitHub, or keep it local for review first?
