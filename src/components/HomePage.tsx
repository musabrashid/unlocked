"use client";

import { useEffect, useState } from "react";
import { AuthButton } from "@/components/AuthButton";
import { UnlockLoader } from "@/components/UnlockLoader";
import { ArticleView } from "@/components/ArticleView";
import {
  SavedArticles,
  type SavedArticleSummary,
} from "@/components/SavedArticles";
import type { UnlockedArticle } from "@/lib/unlock";
import { createClient } from "@/lib/supabase/client";

export function HomePage() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [article, setArticle] = useState<UnlockedArticle | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [savedArticles, setSavedArticles] = useState<SavedArticleSummary[]>([]);
  const [libraryLoading, setLibraryLoading] = useState(true);

  const supabase = createClient();

  useEffect(() => {
    async function loadLibrary() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setIsLoggedIn(!!user);

      if (!user) {
        setLibraryLoading(false);
        return;
      }

      const res = await fetch("/api/articles");
      if (res.ok) {
        const data = await res.json();
        setSavedArticles(data.articles ?? []);
      }
      setLibraryLoading(false);
    }

    loadLibrary();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      loadLibrary();
    });

    return () => subscription.unsubscribe();
  }, [supabase.auth]);

  async function handleUnlock(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim()) return;

    setLoading(true);
    setError(null);
    setArticle(null);
    setSaved(false);

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 35000);

      const res = await fetch("/api/unlock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to unlock article");
        return;
      }

      setArticle(data.article);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (!article || !isLoggedIn) return;

    setSaving(true);
    try {
      const res = await fetch("/api/articles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          originalUrl: article.originalUrl,
          title: article.title,
          content: article.content,
          excerpt: article.excerpt,
          byline: article.byline,
          siteName: article.siteName,
          source: article.source,
          sourceUrl: article.sourceUrl,
        }),
      });

      if (res.ok) {
        setSaved(true);
        const listRes = await fetch("/api/articles");
        if (listRes.ok) {
          const data = await listRes.json();
          setSavedArticles(data.articles ?? []);
        }
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen">
      <header className="flex items-center justify-between gap-3 border-b border-[var(--border)] px-4 py-4 sm:px-6">
        <h1 className="text-lg font-semibold tracking-tight">Unlocked</h1>
        <AuthButton />
      </header>

      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-16">
        {!article ? (
          <div className="flex min-h-[50vh] flex-col items-center justify-center">
            <h2 className="mb-2 text-center text-2xl font-semibold tracking-tight">
              Paste an article link
            </h2>
            <p className="mb-8 text-center text-[var(--muted)]">
              We&apos;ll try to fetch it from public sources and archives.
            </p>

            <form onSubmit={handleUnlock} className="w-full max-w-xl space-y-3">
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://example.com/article..."
                className="w-full rounded-2xl border border-[var(--border)] bg-transparent px-4 py-3.5 text-base outline-none transition focus:border-[var(--accent)] sm:px-5"
                required
              />
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-2xl bg-[var(--accent)] px-6 py-3.5 text-base font-medium text-white transition hover:bg-[var(--accent-hover)] disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
              >
                Unlock
              </button>
              {loading && <UnlockLoader />}
            </form>

            {error && (
              <p className="mt-4 text-center text-sm text-red-500">{error}</p>
            )}

            {isLoggedIn && (
              <SavedArticles
                articles={savedArticles}
                loading={libraryLoading}
              />
            )}
          </div>
        ) : (
          <div>
            <button
              onClick={() => {
                setArticle(null);
                setUrl("");
                setSaved(false);
              }}
              className="mb-8 text-sm text-[var(--muted)] transition hover:text-[var(--foreground)]"
            >
              ← Back
            </button>
            <ArticleView
              article={article}
              onSave={isLoggedIn ? handleSave : undefined}
              saving={saving}
              saved={saved}
            />
            {!isLoggedIn && (
              <p className="mt-8 text-center text-sm text-[var(--muted)]">
                Sign in with Google to save this article to your library.
              </p>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
