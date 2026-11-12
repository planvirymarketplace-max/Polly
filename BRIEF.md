# Polly — Brief (Sunny, verbatim source of truth)

App is called Polly — poll/parrot. A social media app driven by local geo political happenings, a social feed for commentary and polls for engagement and rewards, space for polls sold to local and national stations and non profit organizations.

The goal is to drive down polling cost while getting and engaging users in a non evasive setting where they are selected by the system to participate in polls, galvanize around political ideas, cultures, based on their UGC, followers / friends etc.

- Backend: Supabase
- Deployment: Lightsail
- Login: SSO Socials, Phone OTP, Magiclink, limited guest mode
- Sampling: quota + UGC, UGC match, random and sponsor, creator
- Creator Rewards: Sweepstakes, points, Rev share, and perks tiered for all levels of engagement
- Launch Area: National
- Repo: Monorepo cross-platform mobile app codebase — React Native / Expo. Expo/React Native app runs in a plain browser tab (React Native for Web). `npx expo start --web`, view at a phone viewport, hot reload or Expo Snack (snack.expo.dev)
  - `apps/mobile` → Expo (Expo Router)
  - `apps/web` → Next.js
  - `packages/ui` → shared components (render on both via RN Web)
  - `packages/core` → types, API client, state, business logic

TikTok owns dancing, Facebook owns friends, Polly owns what do you think and why.

The polls aren't a feature, they're the business model: sponsors buy access to a self-selected, passion-driven audience, users get paid for thought patterns they were expressing anyway. No community polls, no advertiser feed, no survey-farm framing.

Polly is a social platform for what people think and why. People gather around information and shared ideas; buyers fund research with relevant, willing participants; users share in the value of their perspectives. Buyers pay to ask relevant people focused questions. Users have opportunities to earn because their perspectives are relevant.

https://github.com/planvirymarketplace-max/Polly.git

---

## How to read this brief (do not reframe it)

- **Product:** a social media app / social platform for what people think and why.
- **Business model:** polls. Sponsors buy access; users get paid.
- **Not a civic app.** Do not call it civic, do not frame it as civic.
- **Not a survey farm, not an advertiser feed.** No community polls.
- **Feed first:** social feed for commentary, creation, followers/friends, UGC, video, live — with safety and controls from age 13.
- **Polls second in the product, first in the money:** polls emerge from social engagement, as invitations the system selects people for. They are not the feed.
