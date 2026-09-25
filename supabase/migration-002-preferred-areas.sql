-- Run this once in the Supabase SQL editor.
-- Additive and safe: it adds a column and touches no existing data.
-- (schema.sql already includes this column for anyone starting fresh.)

alter table public.responses
  add column if not exists preferred_areas jsonb not null default '[]'::jsonb;
