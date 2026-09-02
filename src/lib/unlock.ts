import { parseHTML } from "linkedom";
import { Readability } from "@mozilla/readability";

export type UnlockSource = "direct" | "wayback" | "preview";

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

const DIRECT_TIMEOUT_MS = 5_000;
const ARCHIVE_API_TIMEOUT_MS = 6_000;
const ARCHIVE_FETCH_TIMEOUT_MS = 12_000;
const CDX_TIMEOUT_MS = 15_000;

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

function normalizeWaybackUrl(url: string): string {
  return url.replace(/^http:\/\/web\.archive\.org/i, "https://web.archive.org");
}

function looksLikePaywall(text: string): boolean {
  const sample = text.slice(0, 800);
  return PAYWALL_PATTERNS.some((pattern) => pattern.test(sample));
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function getMetaContent(document: Document, keys: string[]): string | null {
  for (const key of keys) {
    const byProperty = document
      .querySelector(`meta[property="${key}"]`)
      ?.getAttribute("content");
    if (byProperty?.trim()) return byProperty.trim();

    const byName = document
      .querySelector(`meta[name="${key}"]`)
      ?.getAttribute("content");
    if (byName?.trim()) return byName.trim();
  }

  return null;
}

function extractPreview(html: string, pageUrl: string): UnlockedArticle | null {
  const { document } = parseHTML(html);

  const title =
    getMetaContent(document, ["og:title", "twitter:title"]) ||
    document.querySelector("title")?.textContent?.trim();

  const description = getMetaContent(document, [
    "og:description",
    "twitter:description",
    "description",
  ]);

  if (!title || !description || description.length < 80) {
    return null;
  }

  const siteName = getMetaContent(document, ["og:site_name"]);
  const paragraphs = description
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => `<p>${escapeHtml(part)}</p>`)
    .join("");

  return {
    title,
    content: paragraphs || `<p>${escapeHtml(description)}</p>`,
    excerpt: description.slice(0, 200),
    byline: null,
    siteName,
    source: "preview",
    sourceUrl: pageUrl,
    originalUrl: pageUrl,
  };
}

function extractArticle(html: string, pageUrl: string): UnlockedArticle | null {
  const { document } = parseHTML(html);
  const reader = new Readability(document, { charThreshold: 100 });
  const article = reader.parse();

  if (!article?.textContent || article.textContent.trim().length < 200) {
    return null;
  }

  const wordCount = article.textContent.trim().split(/\s+/).length;
  if (wordCount < 300) {
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

async function fetchHtml(
  url: string,
  timeoutMs = ARCHIVE_FETCH_TIMEOUT_MS,
): Promise<string | null> {
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "text/html,application/xhtml+xml",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!response.ok) return null;

    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("text/html")) return null;

    return await response.text();
  } catch {
    return null;
  }
}

async function getWaybackSnapshots(url: string, limit = 6): Promise<string[]> {
  try {
    const cdxUrl =
      `https://web.archive.org/cdx/search/cdx?url=${encodeURIComponent(url)}` +
      `&output=json&limit=-${limit}&filter=statuscode:200` +
      `&filter=mimetype:text/html&collapse=digest`;

    const response = await fetch(cdxUrl, {
      signal: AbortSignal.timeout(CDX_TIMEOUT_MS),
    });

    if (!response.ok) return [];

    const rows = (await response.json()) as string[][];
    if (rows.length <= 1) return [];

    return rows
      .slice(1)
      .sort((a, b) => Number(b[6] ?? 0) - Number(a[6] ?? 0))
      .slice(0, limit)
      .map((row) => `https://web.archive.org/web/${row[1]}/${row[2]}`);
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
      signal: AbortSignal.timeout(ARCHIVE_API_TIMEOUT_MS),
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

async function trySnapshotsBatched(
  snapshotUrls: string[],
  originalUrl: string,
): Promise<UnlockedArticle | null> {
  const unique = [
    ...new Set(snapshotUrls.map((url) => normalizeWaybackUrl(url))),
  ];

  for (let index = 0; index < unique.length; index += 3) {
    const batch = unique.slice(index, index + 3);
    const results = await Promise.all(
      batch.map((url) => tryExtractFromSnapshot(url, originalUrl)),
    );

    const match = results.find((result) => result !== null);
    if (match) return match;
  }

  return null;
}

export async function unlockArticle(
  rawUrl: string,
): Promise<UnlockedArticle | null> {
  const originalUrl = normalizeUrl(rawUrl);

  const archiveMetaPromise = Promise.all([
    getWaybackAvailabilitySnapshot(originalUrl),
    getWaybackSnapshots(originalUrl, 6),
  ]);

  const directHtml = await fetchHtml(originalUrl, DIRECT_TIMEOUT_MS);
  if (directHtml) {
    const direct = extractArticle(directHtml, originalUrl);
    if (direct) {
      return { ...direct, source: "direct", originalUrl };
    }
  }

  const [availability, cdxSnapshots] = await archiveMetaPromise;

  const snapshotUrls = [...cdxSnapshots];
  if (availability && !snapshotUrls.includes(availability)) {
    snapshotUrls.push(availability);
  }

  const archived = await trySnapshotsBatched(snapshotUrls, originalUrl);
  if (archived) return archived;

  if (directHtml) {
    const preview = extractPreview(directHtml, originalUrl);
    if (preview) return { ...preview, originalUrl };
  }

  return null;
}
