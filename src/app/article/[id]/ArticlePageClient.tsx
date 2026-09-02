"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { AuthButton } from "@/components/AuthButton";

interface SavedArticle {
  id: string;
  title: string;
  content: string;
  byline: string | null;
  site_name: string | null;
  original_url: string;
  source: string;
}

export default function ArticlePageClient() {
  const params = useParams();
  const id = params.id as string;
  const [article, setArticle] = useState<SavedArticle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const res = await fetch(`/api/articles/${id}`);
      if (!res.ok) {
        setError("Article not found or you need to sign in.");
        setLoading(false);
        return;
      }
      const data = await res.json();
      setArticle(data.article);
      setLoading(false);
    }
    load();
  }, [id]);

  async function handleDelete() {
    if (!confirm("Delete this article from your library?")) return;
    const res = await fetch(`/api/articles/${id}`, { method: "DELETE" });
    if (res.ok) {
      window.location.href = "/";
    }
  }

  return (
    <div className="min-h-screen">
      <header className="flex items-center justify-between border-b border-[var(--border)] px-6 py-4">
        <Link href="/" className="text-lg font-semibold tracking-tight">
          Unlocked
        </Link>
        <AuthButton />
      </header>

      <main className="mx-auto max-w-2xl px-6 py-12">
        {loading && (
          <div className="h-64 animate-pulse rounded-xl bg-neutral-100 dark:bg-neutral-900" />
        )}
        {error && <p className="text-center text-red-500">{error}</p>}
        {article && (
          <>
            <div className="mb-8 flex items-center justify-between">
              <Link
                href="/"
                className="text-sm text-[var(--muted)] transition hover:text-[var(--foreground)]"
              >
                ← Library
              </Link>
              <button
                onClick={handleDelete}
                className="text-sm text-red-500 transition hover:text-red-600"
              >
                Delete
              </button>
            </div>
            <article>
              <header className="mb-8 border-b border-[var(--border)] pb-6">
                <p className="mb-2 text-sm text-[var(--muted)]">
                  {article.site_name ||
                    new URL(article.original_url).hostname}
                  {article.byline ? ` · ${article.byline}` : ""}
                </p>
                <h1 className="text-3xl font-semibold leading-tight tracking-tight">
                  {article.title}
                </h1>
                <a
                  href={article.original_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-block text-sm text-[var(--accent)]"
                >
                  View original
                </a>
              </header>
              <div
                className="article-content text-[17px] leading-relaxed"
                dangerouslySetInnerHTML={{ __html: article.content }}
              />
            </article>
          </>
        )}
      </main>
    </div>
  );
}
