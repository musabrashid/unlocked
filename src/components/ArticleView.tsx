"use client";

import type { UnlockedArticle } from "@/lib/unlock";

interface ArticleViewProps {
  article: UnlockedArticle;
  onSave?: () => void;
  saving?: boolean;
  saved?: boolean;
}

export function ArticleView({
  article,
  onSave,
  saving,
  saved,
}: ArticleViewProps) {
  return (
    <article className="mx-auto w-full max-w-2xl">
      <header className="mb-8 border-b border-[var(--border)] pb-6">
        <p className="mb-2 text-sm text-[var(--muted)]">
          {article.siteName || new URL(article.originalUrl).hostname}
          {article.byline ? ` · ${article.byline}` : ""}
        </p>
        <h1 className="text-3xl font-semibold leading-tight tracking-tight">
          {article.title}
        </h1>
        <p className="mt-3 text-sm text-[var(--muted)]">
          Source: {article.source === "wayback" ? "Internet Archive" : "Direct"}
        </p>
        {onSave && (
          <button
            onClick={onSave}
            disabled={saving || saved}
            className="mt-4 rounded-full bg-[var(--accent)] px-5 py-2 text-sm font-medium text-white transition hover:bg-[var(--accent-hover)] disabled:opacity-50"
          >
            {saved ? "Saved" : saving ? "Saving…" : "Save to library"}
          </button>
        )}
      </header>
      <div
        className="article-content text-[17px] leading-relaxed"
        dangerouslySetInnerHTML={{ __html: article.content }}
      />
    </article>
  );
}
