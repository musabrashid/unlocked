-- Articles saved per user
create table if not exists public.articles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  original_url text not null,
  title text not null,
  content text not null,
  excerpt text,
  byline text,
  site_name text,
  source text not null check (source in ('direct', 'wayback')),
  source_url text not null,
  created_at timestamptz not null default now()
);

create index if not exists articles_user_id_created_at_idx
  on public.articles (user_id, created_at desc);

alter table public.articles enable row level security;

create policy "Users can view own articles"
  on public.articles for select
  using (auth.uid() = user_id);

create policy "Users can insert own articles"
  on public.articles for insert
  with check (auth.uid() = user_id);

create policy "Users can delete own articles"
  on public.articles for delete
  using (auth.uid() = user_id);
