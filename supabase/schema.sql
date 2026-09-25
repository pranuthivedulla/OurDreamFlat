-- FlatSearch schema. Run once, in the Supabase SQL editor.
-- Safe to re-run: drops first.

drop table if exists public.results   cascade;
drop table if exists public.listings  cascade;
drop table if exists public.responses cascade;
drop table if exists public.searches  cascade;

create table public.searches (
  id          text primary key,              -- short link token, e.g. 'k7x2p'
  created_at  timestamptz not null default now(),
  status      text not null default 'collecting'
              check (status in ('collecting', 'ready'))
);

create table public.responses (
  id            uuid primary key default gen_random_uuid(),
  search_id     text not null references public.searches(id) on delete cascade,
  person        text not null check (person in ('riya', 'meera', 'kavita')),
  rent_cap      integer not null check (rent_cap > 0),
  preferred_areas jsonb not null default '[]'::jsonb,
  no_go_areas   jsonb   not null default '[]'::jsonb,
  must_be_near  jsonb   not null default '[]'::jsonb,
  dealbreakers  jsonb   not null default '[]'::jsonb,
  nice_to_haves jsonb   not null default '[]'::jsonb,
  submitted_at  timestamptz not null default now(),
  unique (search_id, person),
  constraint must_be_near_max_2 check (jsonb_array_length(must_be_near) <= 2),
  constraint dealbreakers_max_3 check (jsonb_array_length(dealbreakers) <= 3)
);

-- Note: the real cap is "dealbreakers + places marked dealbreaker <= 3".
-- That spans two columns via a subquery, which Postgres CHECK constraints do not
-- allow, so it is enforced in validateResponse() in lib/constraints.ts instead --
-- called from both the client form and the server action.

create index responses_search_id_idx on public.responses (search_id);

-- Phase 2/3 tables, created now so the schema is done in one pass.
-- Unknown listing fields stay NULL on purpose: NULL means "not stated", which the
-- filter engine must treat as keep-and-flag, never as a pass.
create table public.listings (
  id           uuid primary key default gen_random_uuid(),
  search_id    text not null references public.searches(id) on delete cascade,
  source       text not null default 'paste' check (source in ('paste', 'apify')),
  url          text,
  rent         integer,
  area         text,
  floor        integer,
  has_lift     boolean,
  parking      boolean,
  bathrooms    integer,
  pet_friendly boolean,
  extras       jsonb not null default '[]'::jsonb,
  added_at     timestamptz not null default now()
);

create index listings_search_id_idx on public.listings (search_id);

create table public.results (
  search_id    text not null references public.searches(id) on delete cascade,
  listing_id   uuid not null references public.listings(id) on delete cascade,
  passed       boolean not null,
  blocked_by   jsonb not null default '[]'::jsonb,
  scores       jsonb not null default '{}'::jsonb,
  commute_mins jsonb not null default '{}'::jsonb,
  ai_summary   jsonb,
  computed_at  timestamptz not null default now(),
  primary key (search_id, listing_id)
);

-- Row Level Security: ON for all four, with NO policies, deliberately.
-- No policies means the anon and authenticated roles can do nothing at all.
-- The service_role key bypasses RLS, so the server routes still work.
-- This is why the browser never receives a Supabase key: there is nothing it
-- could do with one.
alter table public.searches  enable row level security;
alter table public.responses enable row level security;
alter table public.listings  enable row level security;
alter table public.results   enable row level security;

-- Belt and braces on top of RLS: removes the table grants PostgREST relies on,
-- so an anon request fails at the permission layer before RLS is consulted.
revoke all on public.searches, public.responses, public.listings, public.results
  from anon, authenticated;
