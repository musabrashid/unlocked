import { parseHTML } from "linkedom";
import { Readability } from "@mozilla/readability";

export type UnlockSource = "direct" | "wayback";

export interface UnlockedArticle {
  title: string;
  content: string;
  excerpt: string;
  byline: string | null;
  siteName: string | null;
  source: UnlockSource;
  sourceUrl: string;
  originalUrl: string;
}

const PAYWALL_PATTERNS = [
  /subscribe to continue/i,
  /sign in to read/i,
  /already a subscriber/i,
  /create a free account/i,
  /this article is for subscribers/i,
  /you've reached your limit of free articles/i,
  /to continue reading/i,
  /subscribe for full access/i,
  /purchase a subscription/i,
];

const USER_AGENT =
  "Mozilla/5.0 (compatible; UnlockedReader/1.0; +https://github.com/musabrashid/unlocked)";

export function normalizeUrl(raw: string): string {
  const url = new URL(raw.trim());
  url.hash = "";
  for (const key of [...url.searchParams.keys()]) {
    if (
      key.startsWith("utm_") ||
      key === "fbclid" ||
      key === "gclid" ||
      key === "ref"
    ) {
      url.searchParams.delete(key);
    }
  }
  return url.toString();
}

function urlVariants(url: string): string[] {
  const parsed = new URL(url);
  const variants = new Set<string>([url]);

  if (parsed.hostname.startsWith("www.")) {
    const noWww = new URL(url);
    noWww.hostname = parsed.hostname.slice(4);
    variants.add(noWww.toString());
  } else {
    const withWww = new URL(url);
    withWww.hostname = `www.${parsed.hostname}`;
    variants.add(withWww.toString());
  }

  return [...variants];
}

const MIN_ARTICLE_WORDS = 300;

function normalizeWaybackUrl(url: string): string {
  return url.replace(/^http:\/\/web\.archive\.org/i, "https://web.archive.org");
}

function looksLikePaywall(text: string): boolean {
  const sample = text.slice(0, 800);
  return PAYWALL_PATTERNS.some((pattern) => pattern.test(sample));
}

function extractArticle(html: string, pageUrl: string): UnlockedArticle | null {
  const { document } = parseHTML(html);
  const reader = new Readability(document, { charThreshold: 100 });
  const article = reader.parse();

  if (!article?.textContent || article.textContent.trim().length < 200) {
    return null;
  }

  const wordCount = article.textContent.trim().split(/\s+/).length;
  if (wordCount < MIN_ARTICLE_WORDS) {
    return null;
  }

  if (looksLikePaywall(article.textContent)) {
    return null;
  }

  return {
    title: article.title || "Untitled",
    content: article.content || "",
    excerpt: article.excerpt || "",
    byline: article.byline || null,
    siteName: article.siteName || null,
    source: "direct",
    sourceUrl: pageUrl,
    originalUrl: pageUrl,
  };
}

async function fetchHtml(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "text/html,application/xhtml+xml",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(20000),
    });

    if (!response.ok) return null;

    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("text/html")) return null;

    return await response.text();
  } catch {
    return null;
  }
}

async function getWaybackSnapshots(url: string, limit = 8): Promise<string[]> {
  try {
    const parsed = new URL(url);
    const cdxTargets = [
      url,
      `${parsed.origin}${parsed.pathname}`,
    ];

    for (const target of cdxTargets) {
      const cdxUrl =
        `https://web.archive.org/cdx/search/cdx?url=${encodeURIComponent(target)}` +
        `&output=json&limit=-${limit}&filter=statuscode:200` +
        `&filter=mimetype:text/html&collapse=digest`;

      const response = await fetch(cdxUrl, {
        signal: AbortSignal.timeout(12000),
      });

      if (!response.ok) continue;

      const rows = (await response.json()) as string[][];
      if (rows.length <= 1) continue;

      return rows
        .slice(1)
        .sort((a, b) => Number(b[6] ?? 0) - Number(a[6] ?? 0))
        .slice(0, limit)
        .map((row) => {
          const timestamp = row[1];
          const original = row[2];
          return `https://web.archive.org/web/${timestamp}/${original}`;
        });
    }

    return [];
  } catch {
    return [];
  }
}

async function getWaybackAvailabilitySnapshot(
  url: string,
): Promise<string | null> {
  try {
    const apiUrl = `https://web.archive.org/wayback/available?url=${encodeURIComponent(url)}`;
    const response = await fetch(apiUrl, {
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) return null;

    const data = (await response.json()) as {
      archived_snapshots?: {
        closest?: { available?: boolean; url?: string };
      };
    };

    const snapshot = data.archived_snapshots?.closest;
    if (!snapshot?.available || !snapshot.url) return null;

    return normalizeWaybackUrl(snapshot.url);
  } catch {
    return null;
  }
}

async function tryExtractFromSnapshot(
  snapshotUrl: string,
  originalUrl: string,
): Promise<UnlockedArticle | null> {
  const html = await fetchHtml(snapshotUrl);
  if (!html) return null;

  const archived = extractArticle(html, snapshotUrl);
  if (!archived) return null;

  return {
    ...archived,
    source: "wayback",
    sourceUrl: snapshotUrl,
    originalUrl,
  };
}

async function tryWaybackUnlock(
  originalUrl: string,
): Promise<UnlockedArticle | null> {
  const variants = urlVariants(originalUrl);
  const tried = new Set<string>();

  async function trySnapshot(snapshotUrl: string): Promise<UnlockedArticle | null> {
    const normalized = normalizeWaybackUrl(snapshotUrl);
    if (tried.has(normalized)) return null;
    tried.add(normalized);
    return tryExtractFromSnapshot(normalized, originalUrl);
  }

  const availability = await Promise.all(
    variants.map((variant) => getWaybackAvailabilitySnapshot(variant)),
  );

  for (const url of availability) {
    if (!url) continue;
    const result = await trySnapshot(url);
    if (result) return result;
  }

  const cdxLists = await Promise.all(
    variants.map((variant) => getWaybackSnapshots(variant, 6)),
  );

  for (const list of cdxLists) {
    for (const url of list) {
      const result = await trySnapshot(url);
      if (result) return result;
    }
  }

  return null;
}

async function tryDirectUnlock(
  originalUrl: string,
): Promise<UnlockedArticle | null> {
  for (const variant of urlVariants(originalUrl)) {
    const directHtml = await fetchHtml(variant);
    if (!directHtml) continue;

    const direct = extractArticle(directHtml, variant);
    if (direct) {
      return { ...direct, source: "direct", originalUrl };
    }
  }

  return null;
}

export async function unlockArticle(
  rawUrl: string,
): Promise<UnlockedArticle | null> {
  const originalUrl = normalizeUrl(rawUrl);

  const [direct, wayback] = await Promise.all([
    tryDirectUnlock(originalUrl),
    tryWaybackUnlock(originalUrl),
  ]);

  return direct ?? wayback;
}
