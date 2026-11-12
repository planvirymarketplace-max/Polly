// ─────────────────────────────────────────────────────────────
// POLLY — Real RSS/Atom ingestion (no paid key, no new deps).
// Uses stdlib fetch + small regex/XML parsing only.
//
// Rules this module enforces:
//  - Titles/summaries are taken VERBATIM from the feed. Nothing is
//    rewritten, summarized, or invented. HTML is stripped and
//    entities decoded, because that is transport, not content.
//  - Every ingested item keeps its canonical link. The Prisma
//    Happening model has no sourceUrl column (schema is owned by
//    the backend agent), so the link is stored as a
//    `Source: <url>` prefix on `summary` and decoded back out by
//    the happenings API — see encodeSourceUrl / decodeSourceUrl.
//  - Deduped by (title, sourceName).
//  - Topics are assigned by transparent keyword matching only
//    (TOPIC_KEYWORDS below). No ML, no guessing, no default topic:
//    an item that matches nothing gets topicId null.
// ─────────────────────────────────────────────────────────────

import type { PrismaClient } from "@prisma/client";
import { RSS_FEEDS, type RssFeedDef } from "./sources";

export type TopicSlug =
  | "transit"
  | "housing"
  | "education"
  | "elections"
  | "economy"
  | "public-safety"
  | "energy-climate"
  | "healthcare"
  | "tech-privacy";

export interface FeedItem {
  title: string;
  /** Canonical article URL from the feed. */
  link: string;
  /** Verbatim description/summary, HTML stripped. May be "". */
  description: string;
  /** Publication date from the feed, or null if unparseable. */
  pubDate: Date | null;
}

export interface IngestOptions {
  /** Max items taken per feed (default 10). */
  limitPerFeed?: number;
  /** If true, fetch + parse but write nothing. */
  dryRun?: boolean;
  /** If set, only ingest these feed slugs. */
  onlySlugs?: string[];
}

export interface FeedIngestResult {
  slug: string;
  sourceName: string;
  fetched: number;
  inserted: number;
  skipped: number; // duplicates or unusable items
  error?: string;
}

export interface IngestReport {
  dryRun: boolean;
  feeds: FeedIngestResult[];
  inserted: number;
  skipped: number;
  failed: number;
}

const USER_AGENT =
  "PollyMVP/1.0 (+https://github.com/planvirymarketplace-max/Polly; RSS ingestion)";
const FETCH_TIMEOUT_MS = 15000;
/** Storage guard only — truncation is marked, never silent rewriting. */
const MAX_SUMMARY_CHARS = 2000;

// ── Source-URL encoding ──────────────────────────────────────
// Happening has no sourceUrl column. The canonical link travels
// as the first line of `summary` so attribution survives the DB
// round-trip; the API strips it back out for clients.

export const SOURCE_URL_PREFIX = "Source: ";

export function encodeSourceUrl(summary: string, url: string): string {
  const clean = summary.trim();
  return `${SOURCE_URL_PREFIX}${url.trim()}${clean ? `\n\n${clean}` : ""}`;
}

export function decodeSourceUrl(summary: string): {
  summary: string;
  sourceUrl: string | null;
} {
  if (!summary.startsWith(SOURCE_URL_PREFIX)) return { summary, sourceUrl: null };
  const nl = summary.indexOf("\n");
  const firstLine = nl === -1 ? summary : summary.slice(0, nl);
  const url = firstLine.slice(SOURCE_URL_PREFIX.length).trim();
  const rest = nl === -1 ? "" : summary.slice(nl).trim();
  return { summary: rest, sourceUrl: url || null };
}

// ── Topic mapping (transparent keyword lists) ────────────────
// Order = tie-break priority. Matching is case-insensitive with
// word boundaries so "bus" never matches "business".

export const TOPIC_KEYWORDS: Record<TopicSlug, string[]> = {
  transit: [
    "transit", "subway", "light rail", "commuter rail", "amtrak", "bus route",
    "highway", "airport", "traffic", "commute", "infrastructure", "bridge",
    "road", "rail", "toll", "bike lane", "pedestrian",
  ],
  housing: [
    "housing", "rent", "mortgage", "landlord", "tenant", "homeless",
    "zoning", "apartment", "home price", "eviction", "affordable housing",
    "down payment", "property tax",
  ],
  education: [
    "school", "teacher", "student", "college", "university", "education",
    "classroom", "tuition", "curriculum", "school board", "textbook",
  ],
  elections: [
    "election", "vote", "voting", "ballot", "candidate", "campaign",
    "polling place", "midterm", "primary election", "congress", "senate",
    "house of representatives", "bill", "legislat", "lawmaker", "governor",
    "mayor", "referendum",
  ],
  economy: [
    "economy", "jobs", "unemployment", "inflation", "wage", "gdp",
    "stock market", "trade", "tariff", "interest rate", "federal reserve",
    "grocery", "price", "small business", "layoff",
  ],
  "public-safety": [
    "police", "crime", "shooting", "public safety", "prison", "court",
    "arrest", "fire department", "emergency", "gun", "trial", "sentenc",
  ],
  "energy-climate": [
    "climate", "energy", "solar", "wind power", "oil", "natural gas",
    "power grid", "carbon", "emission", "wildfire", "drought", "hurricane",
    "flood", "renewable",
  ],
  healthcare: [
    "health", "hospital", "medicare", "medicaid", "doctor", "disease",
    "vaccine", "drug price", "health insurance", "clinic", "mental health",
  ],
  "tech-privacy": [
    "tech", "privacy", "data breach", "artificial intelligence", "social media",
    "internet", "broadband", "cyber", "algorithm", "smartphone", "app store",
  ],
};

const TOPIC_ORDER: TopicSlug[] = [
  "transit",
  "housing",
  "education",
  "elections",
  "economy",
  "public-safety",
  "energy-climate",
  "healthcare",
  "tech-privacy",
];

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Score each topic by keyword hits; highest wins, ties go to TOPIC_ORDER. Null = no match. */
export function mapTopicToSlug(title: string, summary: string): TopicSlug | null {
  const haystack = `${title} ${summary}`.toLowerCase();
  let best: TopicSlug | null = null;
  let bestScore = 0;
  for (const slug of TOPIC_ORDER) {
    let score = 0;
    for (const kw of TOPIC_KEYWORDS[slug]) {
      const re = new RegExp(`\\b${escapeRegExp(kw.toLowerCase())}\\b`, "i");
      if (re.test(haystack)) score += 1;
    }
    if (score > bestScore) {
      bestScore = score;
      best = slug;
    }
  }
  return best;
}

// ── Minimal XML parsing (RSS 2.0 + Atom, no dependencies) ───

function stripCdata(s: string): string {
  return s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1");
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&#(\d+);/g, (_m, code: string) => {
      const n = Number(code);
      return Number.isFinite(n) ? String.fromCodePoint(n) : _m;
    })
    .replace(/&#x([0-9a-fA-F]+);/g, (_m, code: string) => {
      const n = parseInt(code, 16);
      return Number.isFinite(n) ? String.fromCodePoint(n) : _m;
    });
}

function stripHtml(s: string): string {
  return decodeEntities(stripCdata(s))
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** First `<tag>…</tag>` (or self-closing) inside a block; namespace prefixes tolerated. */
function extractTag(block: string, tag: string): string | null {
  const re = new RegExp(
    `<(?:\\w+:)?${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</(?:\\w+:)?${tag}>`,
    "i",
  );
  const m = block.match(re);
  return m ? m[1].trim() : null;
}

/** Atom link: prefer rel="alternate", else the first <link href="…">. */
function extractAtomLink(block: string): string | null {
  const links = [...block.matchAll(/<link\b([^>]*?)\/?>/gi)];
  for (const [, attrs] of links) {
    const href = attrs.match(/href="([^"]+)"/i)?.[1];
    if (!href) continue;
    const rel = attrs.match(/rel="([^"]+)"/i)?.[1];
    if (!rel || rel === "alternate") return href.trim();
  }
  const first = links[0]?.[1].match(/href="([^"]+)"/i)?.[1];
  return first ? first.trim() : null;
}

function parseDate(raw: string | null): Date | null {
  if (!raw) return null;
  const ms = Date.parse(raw.trim());
  if (!Number.isFinite(ms)) return null;
  const d = new Date(ms);
  // Reject absurd dates (feed garbage) — keep only plausible ones.
  if (d.getFullYear() < 2000 || d.getTime() > Date.now() + 24 * 60 * 60 * 1000) return null;
  return d;
}

/** Parse RSS 2.0 (`<item>`) or Atom (`<entry>`) XML into feed items. */
export function parseFeedXml(xml: string, def: RssFeedDef): FeedItem[] {
  const isAtom = /<feed[\s>]/i.test(xml) || xml.includes("<entry>");
  const blocks = isAtom
    ? [...xml.matchAll(/<entry\b[\s\S]*?<\/entry>/gi)].map((m) => m[0])
    : [...xml.matchAll(/<item\b[\s\S]*?<\/item>/gi)].map((m) => m[0]);

  const items: FeedItem[] = [];
  for (const block of blocks) {
    const title = stripHtml(extractTag(block, "title") ?? "");
    if (!title) continue;
    const link = isAtom
      ? extractAtomLink(block)
      : stripHtml(extractTag(block, "link") ?? "");
    if (!link || !/^https?:\/\//i.test(link)) continue;
    const description = stripHtml(
      extractTag(block, "description") ??
        extractTag(block, "summary") ??
        extractTag(block, "encoded") ?? // <content:encoded>
        extractTag(block, "content") ??
        "",
    );
    const pubDate = parseDate(
      extractTag(block, "pubDate") ??
        extractTag(block, "updated") ??
        extractTag(block, "date") ??
        null,
    );
    items.push({ title, link, description, pubDate });
  }
  return items;
}

// ── Fetching ─────────────────────────────────────────────────

export async function fetchFeedItems(def: RssFeedDef): Promise<FeedItem[]> {
  const res = await fetch(def.url, {
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml, */*;q=0.8",
    },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} ${res.statusText}`);
  }
  const xml = await res.text();
  const items = parseFeedXml(xml, def);
  if (items.length === 0) {
    throw new Error("Feed parsed but contained 0 usable items");
  }
  return items;
}

// ── Ingestion into the DB ────────────────────────────────────

export async function ingestAll(
  db: PrismaClient,
  opts: IngestOptions = {},
): Promise<IngestReport> {
  const limitPerFeed = opts.limitPerFeed ?? 10;
  const dryRun = opts.dryRun ?? false;
  const feeds = opts.onlySlugs
    ? RSS_FEEDS.filter((f) => opts.onlySlugs!.includes(f.slug))
    : RSS_FEEDS;

  const topics = await db.topic.findMany();
  const topicIdBySlug = new Map(topics.map((t) => [t.slug, t.id]));

  const report: IngestReport = { dryRun, feeds: [], inserted: 0, skipped: 0, failed: 0 };

  for (const def of feeds) {
    const result: FeedIngestResult = {
      slug: def.slug,
      sourceName: def.sourceName,
      fetched: 0,
      inserted: 0,
      skipped: 0,
    };
    try {
      const items = await fetchFeedItems(def);
      result.fetched = items.length;
      for (const item of items.slice(0, limitPerFeed)) {
        // Dedupe by (title, sourceName).
        const existing = await db.happening.findFirst({
          where: { title: item.title, sourceName: def.sourceName },
          select: { id: true },
        });
        if (existing) {
          result.skipped += 1;
          continue;
        }
        const topicSlug = mapTopicToSlug(item.title, item.description);
        const summaryText =
          item.description.length > MAX_SUMMARY_CHARS
            ? `${item.description.slice(0, MAX_SUMMARY_CHARS - 1).trimEnd()}…`
            : item.description;
        if (!dryRun) {
          await db.happening.create({
            data: {
              title: item.title,
              summary: encodeSourceUrl(summaryText, item.link),
              sourceName: def.sourceName,
              metro: def.metro,
              stateCode: def.stateCode,
              topicId: topicSlug ? topicIdBySlug.get(topicSlug) ?? null : null,
              createdAt: item.pubDate ?? new Date(),
            },
          });
        }
        result.inserted += 1;
      }
    } catch (e) {
      result.error = e instanceof Error ? e.message : String(e);
      report.failed += 1;
    }
    report.inserted += result.inserted;
    report.skipped += result.skipped;
    report.feeds.push(result);
  }
  return report;
}
