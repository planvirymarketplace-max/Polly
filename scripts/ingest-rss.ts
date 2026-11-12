// ─────────────────────────────────────────────────────────────
// POLLY RSS ingestion — CLI entry point.
// Pulls verbatim headlines from the verified public feeds in
// src/lib/polly/sources.ts into the Happening table with source
// attribution. No invented headlines, dates, or outlets.
//
// Usage:
//   bun scripts/ingest-rss.ts                 # ingest all feeds (10 items each)
//   bun scripts/ingest-rss.ts --dry-run       # fetch + parse, write nothing
//   bun scripts/ingest-rss.ts --limit=5       # max 5 items per feed
//   bun scripts/ingest-rss.ts --source=npr-news,texas-tribune
//   bun scripts/ingest-rss.ts --help
//
// Env (same effect as flags; flags win):
//   DRY_RUN=1   RSS_LIMIT=25   RSS_SOURCES=npr-news,texas-tribune
//   DATABASE_URL (required — Supabase Postgres; pooled URL)
//
// Exit code: 0 if at least one feed ingested, 1 if every feed failed.
// ─────────────────────────────────────────────────────────────

import { PrismaClient } from "@prisma/client";
import { ingestAll } from "../src/lib/polly/rss";
import { RSS_FEEDS } from "../src/lib/polly/sources";

const db = new PrismaClient();

function usage(): void {
  console.log(`Polly RSS ingestion — real headlines from public feeds.

Usage:
  bun scripts/ingest-rss.ts [--dry-run] [--limit=N] [--source=slug,slug]

Flags:
  --dry-run            Fetch + parse only; write nothing to the DB
  --limit=N            Max items per feed (default 10, env RSS_LIMIT)
  --source=a,b         Only ingest these feed slugs (env RSS_SOURCES)
  --help               Show this help

Feeds:
${RSS_FEEDS.map((f) => `  ${f.slug.padEnd(20)} ${f.sourceName} — ${f.url}`).join("\n")}

Env:
  DATABASE_URL   Database connection string (required)`);
}

function parseArgs(argv: string[]): {
  help: boolean;
  dryRun: boolean;
  limit: number | undefined;
  sources: string[] | undefined;
} {
  let help = false;
  let dryRun = process.env.DRY_RUN === "1";
  let limit: number | undefined;
  let sources: string[] | undefined;

  const envLimit = Number(process.env.RSS_LIMIT);
  if (Number.isFinite(envLimit) && envLimit > 0) limit = Math.floor(envLimit);
  if (process.env.RSS_SOURCES) {
    sources = process.env.RSS_SOURCES.split(",").map((s) => s.trim()).filter(Boolean);
  }

  for (const arg of argv) {
    if (arg === "--help" || arg === "-h") help = true;
    else if (arg === "--dry-run") dryRun = true;
    else if (arg.startsWith("--limit=")) {
      const n = Number(arg.slice("--limit=".length));
      if (Number.isFinite(n) && n > 0) limit = Math.floor(n);
    } else if (arg.startsWith("--source=")) {
      sources = arg.slice("--source=".length).split(",").map((s) => s.trim()).filter(Boolean);
    } else {
      console.error(`Unknown argument: ${arg}`);
      help = true;
    }
  }
  return { help, dryRun, limit, sources };
}

async function main() {
  const { help, dryRun, limit, sources } = parseArgs(process.argv.slice(2));
  if (help) {
    usage();
    return;
  }

  if (sources) {
    const unknown = sources.filter((s) => !RSS_FEEDS.some((f) => f.slug === s));
    if (unknown.length > 0) {
      console.error(`Unknown feed slug(s): ${unknown.join(", ")}`);
      console.error(`Known feeds: ${RSS_FEEDS.map((f) => f.slug).join(", ")}`);
      process.exit(1);
    }
  }

  console.log(
    `Ingesting RSS feeds${dryRun ? " (DRY RUN — no writes)" : ""}…`,
  );
  const report = await ingestAll(db, {
    limitPerFeed: limit,
    dryRun,
    onlySlugs: sources,
  });

  for (const f of report.feeds) {
    if (f.error) {
      console.log(`  ✗ ${f.slug} (${f.sourceName}): FAILED — ${f.error}`);
    } else {
      console.log(
        `  ✓ ${f.slug} (${f.sourceName}): fetched ${f.fetched}, inserted ${f.inserted}, skipped ${f.skipped} (duplicates)`,
      );
    }
  }
  console.log(
    `Done: inserted ${report.inserted}, skipped ${report.skipped}, failed feeds ${report.failed}${dryRun ? " (dry run — nothing written)" : ""}.`,
  );

  if (report.failed === report.feeds.length && report.feeds.length > 0) {
    process.exit(1);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
