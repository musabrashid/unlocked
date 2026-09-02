-- Allow saving preview-only articles
alter table public.articles drop constraint if exists articles_source_check;
alter table public.articles add constraint articles_source_check
  check (source in ('direct', 'wayback', 'preview'));
