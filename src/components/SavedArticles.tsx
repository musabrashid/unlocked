"use client";

import Link from "next/link";

export interface SavedArticleSummary {
  id: string;
  original_url: string;
  title: string;
  excerpt: string | null;
  site_name: string | null;
  source: string;
  created_at: string;
}

interface SavedArticlesProps {
  articles: SavedArticleSummary[];
  loading: boolean;
}

export function SavedArticles({ articles, loading }: SavedArticlesProps) {
  if (loading) {
    return (
      <div className="mt-12">
        <h2 className="mb-4 text-lg font-medium">Your library</h2>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-20 animate-pulse rounded-xl bg-neutral-100 dark:bg-neutral-900"
            />
          ))}
        </div>
      </div>
    );
  }

  if (articles.length === 0) return null;

  return (
    <div className="mt-12">
      <h2 className="mb-4 text-lg font-medium">Your library</h2>
      <ul className="space-y-3">
        {articles.map((article) => (
          <li key={article.id}>
            <Link
              href={`/article/${article.id}`}
              className="block rounded-xl border border-[var(--border)] p-4 transition hover:bg-neutral-50 dark:hover:bg-neutral-900"
            >
              <p className="font-medium">{article.title}</p>
              <p className="mt-1 text-sm text-[var(--muted)]">
                {article.site_name ||
                  new URL(article.original_url).hostname}{" "}
                · {new Date(article.created_at).toLocaleDateString()}
              </p>
              {article.excerpt && (
                <p className="mt-2 line-clamp-2 text-sm text-[var(--muted)]">
                  {article.excerpt}
                </p>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
