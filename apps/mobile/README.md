# Polly mobile (Expo)

Expo (Expo Router) app for Polly. Screens live in `src/app/(tabs)/` — feed,
polls, rewards, profile — plus `src/app/auth.tsx` for sign-in. The app talks
to the Polly web API (`src/app/api/*` at the repo root) over HTTP; it holds
no demo users and no mock data. Polls are sponsor-only: there is no
poll-creation UI in this app.

## Pointing the app at an API

The API base URL resolves in this order (`src/lib/api.ts`):

1. `EXPO_PUBLIC_API_URL` env var — highest priority.
2. `extra.apiUrl` in `app.json` (default `http://localhost:3000`).
3. `http://localhost:3000` fallback.

Local dev (web app on your machine):

```bash
cd apps/mobile
bun install
EXPO_PUBLIC_API_URL=http://localhost:3000 npx expo start --web
# or: npx expo start   (scan the QR with Expo Go; your phone must reach
# the API host — use your machine's LAN IP instead of localhost)
```

Deployed host (Lightsail):

```bash
EXPO_PUBLIC_API_URL=https://<your-lightsail-host> npx expo start
```

To make a host permanent for a build, set `extra.apiUrl` in `app.json` to
that host instead of passing the env var each time. Do not commit secrets
in `app.json` — the API URL is public, but Supabase keys are not (below).

## Auth (Supabase)

Set these before any sign-in method works (create a `.env` in
`apps/mobile/` — never commit it):

```bash
EXPO_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<anon / publishable key>
```

Methods: Google + Apple SSO (redirect `polly://auth/callback`), phone OTP,
magic link, and guest mode. If the two vars above are missing, every
method shows "coming soon — needs configuration" and the app still lets
guests browse the feed. Tokens are stored in expo-secure-store
(iOS/Android) or localStorage (web), and sent as
`Authorization: Bearer <token>` on every API call. There is no `uid`
param anywhere — identity comes from the JWT.

Still needed from Sunny (blockers, not code): a Supabase project with
Google + Apple providers enabled (Apple needs a Service ID), Twilio
connected in Supabase for phone OTP, and anonymous sign-ins enabled if
guest voting is wanted. Native releases also need EAS + Apple/Google
developer accounts — the app is **not store-ready** until those exist.

Note: `query-string@7` is a direct dependency because `expo-router`
requires it at runtime without declaring it (its `getPathFromState`
calls `queryString.stringify`); without it the web bundle fails to
resolve. `react-native-web` + `react-dom` are required for `expo start
--web` and were missing from the original `package.json`.

## Verify

```bash
cd apps/mobile
bun install          # or npm install
bun run typecheck    # tsc --noEmit
npx expo start --web # http://localhost:8081
```
