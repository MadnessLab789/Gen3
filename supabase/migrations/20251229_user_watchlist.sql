-- Watchlist persistence for Telegram users (anon client)
-- This table stores which fixtures a user has starred (watchlist).

create table if not exists public.user_watchlist (
  telegram_id bigint not null,
  fixture_id bigint not null,
  created_at timestamptz not null default now(),
  primary key (telegram_id, fixture_id)
);

comment on table public.user_watchlist is 'Per-user watchlist (starred fixtures) keyed by Telegram numeric id.';

-- NOTE:
-- If you are using anon key without Supabase Auth, RLS can block reads/writes.
-- For simplest setup, keep RLS disabled for this table.
alter table public.user_watchlist disable row level security;


