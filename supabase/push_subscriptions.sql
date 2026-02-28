-- Web Push subscriptions table and RLS policies.
-- Already included in migrations/0001_init.sql.
-- Use this file as a standalone reference for manual Supabase setup
-- or to re-apply if the table is missing.

-- ── Table ──────────────────────────────────────────────────────────────────

create table if not exists public.push_subscriptions (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        not null references public.profiles (id) on delete cascade,
  endpoint   text        not null,
  p256dh     text        not null,
  auth       text        not null,
  created_at timestamptz not null default now(),
  unique (user_id, endpoint)
);

create index if not exists push_subscriptions_user_id_idx
  on public.push_subscriptions (user_id);

-- ── Row Level Security ─────────────────────────────────────────────────────

alter table public.push_subscriptions enable row level security;

-- Each user can only read their own subscriptions
create policy "push_subscriptions_owner_select"
  on public.push_subscriptions for select
  using (user_id = auth.uid());

-- A user can only insert a subscription for themselves
create policy "push_subscriptions_owner_insert"
  on public.push_subscriptions for insert
  with check (user_id = auth.uid());

-- A user can only update their own subscriptions
create policy "push_subscriptions_owner_update"
  on public.push_subscriptions for update
  using  (user_id = auth.uid())
  with check (user_id = auth.uid());

-- A user can only delete their own subscriptions
create policy "push_subscriptions_owner_delete"
  on public.push_subscriptions for delete
  using (user_id = auth.uid());

-- ── Notes ──────────────────────────────────────────────────────────────────
-- The server-side push sender (lib/push.ts) uses the SERVICE_ROLE key via
-- createSupabaseAdminClient(), which bypasses RLS — this is intentional so
-- the server can delete stale (410/404) endpoints without user context.
