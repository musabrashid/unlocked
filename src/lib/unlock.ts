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

function looksLikePaywall(text: string): boolean {
  const sample = text.slice(0, 2000);
  return PAYWALL_PATTERNS.some((pattern) => pattern.test(sample));
}

function extractArticle(html: string, pageUrl: string): UnlockedArticle | null {
  const { document } = parseHTML(html);
  const reader = new Readability(document, { charThreshold: 100 });
  const article = reader.parse();

  if (!article?.textContent || article.textContent.trim().length < 200) {
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
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) return null;

    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("text/html")) return null;

    return await response.text();
  } catch {
    return null;
  }
}

interface WaybackSnapshot {
  available: boolean;
  url?: string;
}

async function getWaybackSnapshot(url: string): Promise<string | null> {
  try {
    const apiUrl = `https://archive.org/wayback/available?url=${encodeURIComponent(url)}`;
    const response = await fetch(apiUrl, {
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) return null;

    const data = (await response.json()) as {
      archived_snapshots?: { closest?: WaybackSnapshot };
    };

    const snapshot = data.archived_snapshots?.closest;
    if (!snapshot?.available || !snapshot.url) return null;

    return snapshot.url;
  } catch {
    return null;
  }
}

export async function unlockArticle(
  rawUrl: string,
): Promise<UnlockedArticle | null> {
  const originalUrl = normalizeUrl(rawUrl);

  const directHtml = await fetchHtml(originalUrl);
  if (directHtml) {
    const direct = extractArticle(directHtml, originalUrl);
    if (direct) {
      return { ...direct, source: "direct", originalUrl };
    }
  }

  const waybackUrl = await getWaybackSnapshot(originalUrl);
  if (waybackUrl) {
    const waybackHtml = await fetchHtml(waybackUrl);
    if (waybackHtml) {
      const archived = extractArticle(waybackHtml, waybackUrl);
      if (archived) {
        return {
          ...archived,
          source: "wayback",
          sourceUrl: waybackUrl,
          originalUrl,
        };
      }
    }
  }

  return null;
}
