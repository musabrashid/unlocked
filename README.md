# Unlocked

A personal article reader that fetches articles from public sources and the Internet Archive, then saves them to your library.

## Features

- Paste any article URL to try unlocking it (direct fetch or Wayback Machine)
- Clean, readable article view (Mozilla Readability)
- Sign in with Google to save articles
- Personal library of saved articles

## Setup

### 1. Supabase

1. Create a project at [supabase.com](https://supabase.com)
2. Run the SQL in `supabase/migrations/001_articles.sql` in the SQL Editor
3. Enable Google auth: Authentication → Providers → Google
4. Add redirect URL: `http://localhost:3000/auth/callback` (and your production URL)

### 2. Environment variables

Copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
```

Fill in your Supabase URL and anon key from Project Settings → API.

### 3. Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Deploy on Vercel

1. Push to GitHub
2. Import the repo in [Vercel](https://vercel.com)
3. Add environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `NEXT_PUBLIC_SITE_URL` (your Vercel URL)
4. Add the Vercel callback URL to Supabase Google auth redirect URLs:
   - `https://your-app.vercel.app/auth/callback`

## Limitations

This is a **best-effort** reader. It works when:
- The article is publicly accessible without a paywall
- A usable snapshot exists on the Internet Archive

It will **not** reliably unlock subscription-only content from sites like NYT, WSJ, etc.
