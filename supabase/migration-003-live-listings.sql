-- Run once in the Supabase SQL editor. Additive and safe: adds columns only.

alter table public.searches
  add column if not exists apify_run_id text,
  add column if not exists apify_dataset_id text,
  add column if not exists listings_source text;
