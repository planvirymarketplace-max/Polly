// ─────────────────────────────────────────────────────────────
// POLLY seed — REFERENCE DATA ONLY.
// ─────────────────────────────────────────────────────────────
// This script seeds ONLY the 9-topic taxonomy that the rest of
// Polly references (feed filters, poll topics, interest graph).
// It seeds NO users, NO sponsors, NO happenings, NO polls, NO
// responses, NO comments, and NO invented headlines.
//
// Real feed content comes from RSS ingestion — see
//   scripts/ingest-rss.ts  (CLI)
//   src/lib/polly/rss.ts   (fetch/parse/topic mapping)
//   src/lib/polly/sources.ts (verified public feed registry)
// which pulls verbatim titles/summaries from real news and civic
// outlets with source attribution. The old fictional demo dataset
// (fictional wire services, demo users, synthetic respondents)
// was removed and MUST NOT be reintroduced as seed data.
//
// Usage:
//   bun scripts/seed.ts            # upsert the 9 topics (idempotent)
//   bun scripts/seed.ts --help     # usage
//
// Requires DATABASE_URL (Supabase Postgres pooled URL —
// never hardcode a credential here).
// ─────────────────────────────────────────────────────────────

import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

const TOPICS = [
  { slug: "transit", label: "Transit & Infrastructure", emoji: "🚇" },
  { slug: "housing", label: "Housing", emoji: "🏘️" },
  { slug: "education", label: "Education", emoji: "🎓" },
  { slug: "elections", label: "Elections & Voting", emoji: "🗳️" },
  { slug: "economy", label: "Economy & Jobs", emoji: "💼" },
  { slug: "public-safety", label: "Public Safety", emoji: "🚨" },
  { slug: "energy-climate", label: "Energy & Climate", emoji: "⚡" },
  { slug: "healthcare", label: "Healthcare", emoji: "🏥" },
  { slug: "tech-privacy", label: "Tech & Privacy", emoji: "🔒" },
] as const;

function usage(): void {
  console.log(`Polly seed — topics only (no users, sponsors, happenings, polls, or responses).

Usage:
  bun scripts/seed.ts            Upsert the 9 reference topics (idempotent)
  bun scripts/seed.ts --help     Show this help

Real feed content is NOT seeded here. Run ingestion instead:
  bun scripts/ingest-rss.ts --help

Env:
  DATABASE_URL   Database connection string (required)`);
}

async function main() {
  if (process.argv.includes("--help") || process.argv.includes("-h")) {
    usage();
    return;
  }

  console.log("Seeding topics (reference data only)...");
  for (const t of TOPICS) {
    await db.topic.upsert({
      where: { slug: t.slug },
      update: { label: t.label, emoji: t.emoji },
      create: { slug: t.slug, label: t.label, emoji: t.emoji },
    });
  }

  const count = await db.topic.count();
  console.log(`Seed complete: ${count} topics. No users, sponsors, happenings, polls, or responses seeded.`);
  console.log("Next: run `bun scripts/ingest-rss.ts` to pull real happenings from public RSS feeds.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
