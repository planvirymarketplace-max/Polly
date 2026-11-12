# Polly — Revised MVP Plan (safety-first)

**Date:** Thu 2026-11-12
**Branch:** `mvp-deploy` (code-complete for polls + comments only — see `MVP_HANDOVER.md`)
**Status:** Re-scope only. This plan is NOT built yet. No video, messaging, Firebase, CDN, safety, creation, or go-live code exists in the repo as of 2026-11-12 — verified by grep (see §1).

## 1. What Sunny corrected — and what was actually in the build

The polls + comments build is a prototype, not a social MVP. Sunny's rule, 2026-11-12:

> There is no MVP without safety and controls for users starting at 13, or creation tools / posting tools, or video / go-live, or social features. You cannot have a feed if you don't have a tool that aids in content generation.

Verified gaps in `mvp-deploy`:
- **Video:** none. No provider, no `expo-camera` / `expo-av`, no Mux / LiveKit / Agora / Cloudflare Stream.
- **In-app messaging:** none. No DMs, no Sendbird / Stream / GetStream, no websockets, no Supabase Realtime channels.
- **Firebase:** not used at all. Backend is Supabase only (`@supabase/supabase-js`, `@supabase/ssr`). No Firebase Auth / Firestore / FCM / Storage.
- **CDN / media:** none. No Supabase Storage bucket, no S3 / CloudFront / Cloudflare. Only `public/logo.svg` served by the Lightsail container.
- **Social engagement schema:** 10 models only. `User.followerCount` is an int counter (no Follow table), `Comment.likes` is an int counter (no Like/Reaction table), no Post, Message, Conversation, Share, Save, Reply, or Notification model. The only UGC signal is `UserInterest.affinity`.
- **Trust & safety:** essentially zero. No DOB, no age verification, lowest `ageBracket` is 18-24, no 13-17 handling, no COPPA / parental consent, no report / block / mute, no moderation queue, no profanity/NSFW filter, no admin console (explicitly deferred in `MVP_HANDOVER.md` §7).
- **Creation / posting:** one text box to comment (max 500 chars) on a happening. No standalone post composer, no drafts, no image/video upload, no edit/delete, no AI aid.
- **Go live:** none.

## 2. Revised MVP definition — SOCIAL MEDIA APP, NOT A CIVIC APP (corrected 2026-11-12)

Sunny led with this: Polly is a social media app. That is the product — people gather around local geo-political happenings, information and shared ideas. There is no civic label. The earlier build inverted it (sponsor polls first, feed as RSS + comments second). This plan corrects that order.

A shippable MVP must let a 13+ user, safely:
1. Sign up with a verified age, in teen mode if 13-17.
2. Gather around a happening — a local council vote, a school board decision, a neighborhood issue, a national story with local impact — and talk about it with people, friends and followers.
3. Create a post (text, photo, or short video) with an AI draft aid, and post it to the feed.
4. Follow people, be followed, like/react, reply, share/save, and message people they know — with controls.
5. Watch / go live (recorded video first, live second — see phasing).
6. See a feed that is people + happenings, not just RSS headlines + comments.
7. Be invited to a sponsor poll, vote, and earn — only as an opt-in invitation that emerges from the social engagement above, never as the feed itself. The existing polls engine is unchanged, but it is layer 2, not layer 1.
8. Report, block, and mute — and have a human moderation queue actually review it.

Everything below is real, no mock data, same rule as before.

## 3. Stack decisions (recommended defaults)

| Need | Recommended | Why | Alternative | New keys / accounts needed |
|---|---|---|---|---|
| Video, recorded | **Mux** — upload + playback, Mux CDN built in | Cheapest honest path for short video, no video infra to run, works web + Expo | Cloudflare Stream | Mux token ID + secret, webhook secret |
| Video, go live | **LiveKit Cloud** | Real-time live, recording to Mux/S3, Expo + web SDKs, moderation hooks (kick/mute) | Mux Live, Agora | LiveKit API key + secret, live room config |
| In-app messaging | **Supabase Realtime + Postgres tables** (`Conversation`, `Message`) | Already the backend, no second vendor, RLS governs access, report/block enforced in SQL | Stream / Sendbird (later, if moderation-at-scale is needed) | None — Supabase project only |
| Firebase | **Do NOT add** | Would duplicate Supabase Auth + Postgres. Push can be Expo Push + FCM/APNs without Firebase as the app backend. Add Firebase only if Sunny explicitly wants it as the push/messaging vendor. | Firebase (FCM + Firestore) if Sunny insists | Firebase project, FCM key |
| Media storage + CDN | **Supabase Storage** (public `media` bucket, CDN) + **Cloudflare in front of Lightsail** for web assets | One backend, signed URLs for private teen media, Mux CDN for video | S3 + CloudFront | Supabase Storage bucket + policies; Cloudflare zone |
| Content-gen aid + text moderation | **OpenAI API** — `gpt` for draft aid, Moderation API for text pre-check | One key, both jobs, no new infra; every AI draft is editable, never auto-posted | Anthropic + Perspective API | `OPENAI_API_KEY` |
| Image / video safety | **OpenAI moderation for text + Mux / LiveKit hooks + human queue for MVP**; Hive / Spectrum Labs later | Keeps Friday scope honest; automated NSFW/CSAM scanning is a post-MVP vendor decision, not a hand-rolled filter | Hive, Google Vision SafeSearch | Vendor key (post-MVP) |
| Push notifications | **Expo Push** (APNs/FCM under the hood) | Already Expo; poll invites + replies + moderation outcomes | Supabase + FCM directly | Expo project, APNs/FCM creds (post-MVP for store builds) |

## 4. Safety — starting at 13 (non-negotiable)

### Age & consent
- `User.dateOfBirth` (required at signup, never shown publicly), derived `ageGroup`: `UNDER_13` (blocked), `TEEN_13_15`, `TEEN_16_17`, `ADULT_18_PLUS`.
- Under 13: cannot create an account. No COPPA workaround in MVP.
- 13-15: parental consent required (email verification link to a parent/guardian, stored `parentalConsentAt` + `parentEmailHash`). Account is restricted until consent is recorded.
- 16-17: teen mode, no parental consent required in MVP, but parent contact optional.
- Age is re-checked on every auth refresh; lying about DOB is a reportable / bannable offence, not a UI bypass.

### Teen mode defaults (13-17, cannot be turned off by the teen)
- Profile private by default; followers must be approved.
- No DMs from strangers — DMs only from mutual follows, or off entirely for 13-15.
- No precise location, no metro-level poll targeting without explicit opt-in, no public follower/following lists.
- No sponsor poll invites that use sensitive targeting; no direct sponsor contact.
- No live streaming as a broadcaster under 16; 16-17 live only to followers, with a moderator present / delayed chat.
- Daily time / notification limits, and a visible "Why am I seeing this?" on every feed item and poll.

### Controls every user gets
- Report (post, comment, live, DM, profile, poll) with reason + evidence snapshot.
- Block, mute, hide, restrict replies (followers only / no replies), delete own content, download / delete account.
- Report → `Report` row → moderation queue → `ModerationAction` (hide, warn, suspend, ban). No report disappears without a status.
- Rate limits on posting, commenting, messaging, and reporting (anti-spam, anti-brigading).
- All moderation actions are logged, appealable, and visible to the affected user.

### Content rules (enforced, not just written)
- Pre-post text check (OpenAI Moderation API), image/video check at upload, live chat slow-mode + keyword blocklist + human mod tools.
- No sexual content involving minors, no CSAM, no grooming, no harassment, no hate, no self-harm encouragement — immediate hide + human review + law-enforcement escalation path documented in the safety policy.
- Sponsor polls are never shown to 13-15 without teen-safe review; political content is labelled with source + date.

## 5. Social engagement schema — what to add

Add to `prisma/schema.prisma` (Postgres, RLS to match). Existing 10 models stay.

```prisma
model Post {
  id          String   @id @default(cuid())
  authorId    String
  body        String
  happeningId String?  // optional link to a happening
  visibility  String   @default("PUBLIC") // PUBLIC | FOLLOWERS | PRIVATE
  status      String   @default("LIVE")   // LIVE | HIDDEN | UNDER_REVIEW | REMOVED
  likeCount   Int      @default(0)
  replyCount  Int      @default(0)
  shareCount  Int      @default(0)
  aiAssisted  Boolean  @default(false)    // was the AI draft aid used?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  author      User     @relation(fields: [authorId], references: [id])
  media       PostMedia[]
  likes       PostLike[]
  replies     Comment[] // Comment.parentPostId, see below
  shares      Share[]
}

model PostMedia {
  id        String @id @default(cuid())
  postId    String
  kind      String // IMAGE | VIDEO
  storagePath String // Supabase Storage path
  muxAssetId  String? // Mux asset for video
  playbackId  String? // Mux playback ID (CDN)
  width     Int?
  height    Int?
  durationSec Float?
  post      Post   @relation(fields: [postId], references: [id], onDelete: Cascade)
}

model Follow {
  followerId String
  followingId String
  status     String @default("ACTIVE") // ACTIVE | PENDING (teen private) | BLOCKED
  createdAt  DateTime @default(now())
  @@id([followerId, followingId])
  @@index([followingId])
}

model PostLike { // one row per user per post — replaces the int counter
  userId String
  postId String
  kind   String @default("LIKE") // LIKE | LOVE | INSIGHTFUL | DISAGREE
  createdAt DateTime @default(now())
  @@id([userId, postId])
}

model Share {
  id        String   @id @default(cuid())
  userId    String
  postId    String
  createdAt DateTime @default(now())
  @@unique([userId, postId])
}

model Conversation {
  id        String   @id @default(cuid())
  isGroup   Boolean  @default(false)
  createdAt DateTime @default(now())
  members   ConversationMember[]
  messages  Message[]
}

model ConversationMember {
  conversationId String
  userId         String
  muted          Boolean @default(false)
  createdAt      DateTime @default(now())
  @@id([conversationId, userId])
}

model Message {
  id             String   @id @default(cuid())
  conversationId String
  senderId       String
  body           String
  status         String   @default("SENT") // SENT | HIDDEN | REMOVED
  createdAt      DateTime @default(now())
}

model Report {
  id          String   @id @default(cuid())
  reporterId  String
  targetType  String   // POST | COMMENT | MESSAGE | LIVE | PROFILE | POLL
  targetId    String
  reason      String
  detail      String?
  status      String   @default("OPEN") // OPEN | REVIEWING | RESOLVED | DISMISSED
  createdAt   DateTime @default(now())
  actions     ModerationAction[]
}

model Block {
  blockerId String
  blockedId String
  createdAt DateTime @default(now())
  @@id([blockerId, blockedId])
}

model ModerationAction {
  id         String   @id @default(cuid())
  reportId   String?
  moderatorId String?
  action     String   // HIDE | WARN | SUSPEND | BAN | RESTORE
  reason     String
  createdAt  DateTime @default(now())
  report     Report?  @relation(fields: [reportId], references: [id])
}

model LiveStream {
  id         String   @id @default(cuid())
  hostId     String
  title      String
  livekitRoom String
  status     String   @default("SCHEDULED") // SCHEDULED | LIVE | ENDED
  startedAt  DateTime?
  endedAt    DateTime?
  recordingPlaybackId String?
  createdAt  DateTime @default(now())
}
```

Also extend `User`: `dateOfBirth DateTime?`, `ageGroup String?`, `parentalConsentAt DateTime?`, `isTeen Boolean @default(false)`, `profilePrivate Boolean @default(false)`.
Extend `Comment`: `parentPostId String?`, `parentCommentId String?` (replies), `status String @default("LIVE")`.

## 6. Creation tools + content-generation aid

- **Post composer (web + mobile):** text (up to 1,000 chars), photo (Supabase Storage), short video (Mux direct upload), link to a happening, visibility picker, draft save.
- **AI aid (never auto-posts):** from a happening or a blank draft — "Summarise this happening in my voice", "Turn this into a take", "Make a shorter headline", "Check tone". User edits, then posts. `aiAssisted=true` is stored and shown on the post.
- **Feed:** two tabs — Following (people you follow + their posts) and For You (happenings + posts matched to `UserInterest`, with "Why am I seeing this?"). Polls stay sponsor-only and are interleaved only where the user was selected, with the selection reason shown.
- **Posting tools:** edit own post (history kept), delete, save draft, schedule (post-MVP), repost/share with comment.

## 7. API routes to add (all JWT-gated, RLS-backed)

- `POST /api/posts`, `GET /api/feed`, `GET /api/posts/[id]`, `PATCH/DELETE /api/posts/[id]`
- `POST /api/posts/[id]/like`, `POST /api/posts/[id]/share`, `POST /api/posts/[id]/save`
- `POST /api/follow/[userId]`, `DELETE /api/follow/[userId]`, `GET /api/users/[id]/followers`
- `POST /api/conversations`, `GET /api/conversations`, `POST /api/conversations/[id]/messages`
- `POST /api/media/upload` (Supabase Storage signed upload), `POST /api/media/video` (Mux direct upload)
- `POST /api/ai/draft` (OpenAI, rate-limited, teen-safe prompt guardrails)
- `POST /api/live`, `POST /api/live/[id]/end` (LiveKit room + recording)
- `POST /api/report`, `POST /api/block`, `POST /api/mute`
- `GET /api/moderation/queue`, `POST /api/moderation/[reportId]/action` (moderator role only)

## 8. Honest phasing — Friday 3pm cannot hold all of this

| Phase | Scope | Testable when |
|---|---|---|
| **Phase 1 — Safety-first core** | DOB/age gate + teen mode, report/block/mute + moderation queue, Post composer (text + photo) + AI draft aid, Follow/Like/Reply/Share, Following + For You feed, Supabase Storage + CDN | First testable build once Supabase + Mux/OpenAI keys exist. This is the new Friday target *if* Sunny supplies credentials today. |
| **Phase 2 — Video** | Recorded short video (Mux upload/playback), video in feed, video safety check | After Phase 1 is green |
| **Phase 3 — Live + messaging** | LiveKit go-live (16+ only, followers-only, mod tools), DMs (mutual follows only, teen rules), push notifications | After Phase 2 |
| **Post-MVP** | Firebase only if Sunny insists, Stream/Sendbird, Hive video safety, EAS/store builds, per-metro ACS targets, sponsor billing/payouts | — |

Do not claim Phase 2/3 are done when they are not. Each phase gets its own smoke test (see `MVP_HANDOVER.md` §6 pattern).

## 9. Decisions Sunny must make (defaults apply if unanswered by Fri 09:00 CST)

1. **Video provider:** Mux + LiveKit (recommended) vs Cloudflare Stream vs Agora — default Mux + LiveKit.
2. **Firebase:** add it (as push/messaging vendor) or stay Supabase-only (recommended) — default Supabase-only.
3. **Teen ages:** 13-15 parental consent required (recommended) vs 13+ with teen mode only — default consent required for 13-15.
4. **Live age floor:** 16+ to broadcast (recommended) vs 13+ with mod — default 16+.
5. **AI provider:** OpenAI (recommended) vs Anthropic — default OpenAI.
6. **New deploy date:** keep Fri 2026-11-13 15:00 CST for Phase 1 only, or move the full MVP date — Sunny to confirm.
7. **Credentials still missing (from `MVP_HANDOVER.md` §8):** Supabase project + keys, AWS/Lightsail access, Google/Apple OAuth, Twilio (optional). Plus now: Mux keys, LiveKit keys, OpenAI key.

## 10. What happens next

On Sunny's go-ahead, build in this order: schema + RLS → safety (age gate, teen mode, report/block/mute, moderation queue) → creation (composer + Storage + AI draft) → social (follow/like/reply/share, feed) → video (Mux) → live + messaging (LiveKit + Realtime). Each step typechecks, builds, and gets a smoke test before the next starts. No mock data at any step.
