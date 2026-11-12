// ─────────────────────────────────────────────────────────────
// POLLY — Real source registry for RSS ingestion.
// Every entry here is a free, public RSS/Atom feed: no API key,
// no paid tier, no scraping. Titles and summaries are ingested
// verbatim from the feed (never rewritten or invented) and always
// carry the outlet name + canonical link as attribution.
//
// VERIFIED LIVE 2026-11-12 (fetched from this sandbox):
//   NPR News, NPR Politics, The Texas Tribune, Chicago Sun-Times,
//   Los Angeles Times, Star Tribune, govinfo Congressional Bills,
//   Congress.gov Most-Viewed Bills.
//
// DROPPED after live verification failed (do NOT re-add without
// re-verifying the URL returns a parseable feed):
//   AP News (apnews.com — connection refused from sandbox),
//   Reuters rssFeed/* (HTTP 401 bot wall),
//   White House briefing-room feed (HTTP 404),
//   Chicago Tribune /feed/ (HTTP 403),
//   Denver Post /feed/ (HTTP 403).
// ─────────────────────────────────────────────────────────────

export interface RssFeedDef {
  /** Stable slug, used for --source filtering and logging. */
  slug: string;
  /** Real outlet name, stored as Happening.sourceName. */
  sourceName: string;
  /** Public RSS/Atom feed URL. */
  url: string;
  /** Metro the feed covers, or null for national feeds. */
  metro: string | null;
  /** Two-letter state code, or null for national feeds. */
  stateCode: string | null;
  /** NEWS = press outlet, CIVIC = official government feed. */
  kind: "NEWS" | "CIVIC";
}

export const RSS_FEEDS: RssFeedDef[] = [
  {
    slug: "npr-news",
    sourceName: "NPR",
    url: "https://feeds.npr.org/1001/rss.xml",
    metro: null,
    stateCode: null,
    kind: "NEWS",
  },
  {
    slug: "npr-politics",
    sourceName: "NPR Politics",
    url: "https://feeds.npr.org/1014/rss.xml",
    metro: null,
    stateCode: null,
    kind: "NEWS",
  },
  {
    slug: "texas-tribune",
    sourceName: "The Texas Tribune",
    url: "https://www.texastribune.org/feed/",
    metro: null,
    stateCode: "TX",
    kind: "NEWS",
  },
  {
    slug: "chicago-sun-times",
    sourceName: "Chicago Sun-Times",
    url: "https://chicago.suntimes.com/rss/index.xml",
    metro: "Chicago",
    stateCode: "IL",
    kind: "NEWS",
  },
  {
    slug: "la-times",
    sourceName: "Los Angeles Times",
    url: "https://www.latimes.com/rss2.0.xml",
    metro: "Los Angeles",
    stateCode: "CA",
    kind: "NEWS",
  },
  {
    slug: "star-tribune",
    sourceName: "Star Tribune",
    url: "https://www.startribune.com/rss",
    metro: "Minneapolis",
    stateCode: "MN",
    kind: "NEWS",
  },
  {
    slug: "govinfo-bills",
    sourceName: "govinfo — Congressional Bills",
    url: "https://www.govinfo.gov/rss/bills.xml",
    metro: null,
    stateCode: null,
    kind: "CIVIC",
  },
  {
    slug: "congress-bills",
    sourceName: "Congress.gov — Most-Viewed Bills",
    url: "https://www.congress.gov/rss/most-viewed-bills.xml",
    metro: null,
    stateCode: null,
    kind: "CIVIC",
  },
];

export function feedBySlug(slug: string): RssFeedDef | undefined {
  return RSS_FEEDS.find((f) => f.slug === slug);
}
