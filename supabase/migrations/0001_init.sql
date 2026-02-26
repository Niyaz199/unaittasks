-- Extensions
create extension if not exists pgcrypto;

-- Tables
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null,
  role text not null check (role in ('admin', 'chief', 'lead', 'engineer')),
  created_at timestamptz not null default now()
);

create table if not exists public.objects (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now(),
  created_by uuid not null references public.profiles (id)
);

create table if not exists public.user_objects (
  user_id uuid not null references public.profiles (id) on delete cascade,
  object_id uuid not null references public.objects (id) on delete cascade,
  primary key (user_id, object_id)
);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  object_id uuid not null references public.objects (id),
  status text not null check (status in ('new', 'in_progress', 'paused', 'done')) default 'new',
  priority text not null check (priority in ('low', 'medium', 'high', 'critical')) default 'medium',
  due_at timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid not null references public.profiles (id),
  assigned_to uuid not null references public.profiles (id),
  accepted_at timestamptz,
  completed_at timestamptz,
  archived_at timestamptz
);

create table if not exists public.task_comments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks (id) on delete cascade,
  author_id uuid not null references public.profiles (id),
  body text not null,
  created_at timestamptz not null default now(),
  client_msg_id text
);

create unique index if not exists task_comments_dedupe_idx
  on public.task_comments (task_id, author_id, client_msg_id)
  where client_msg_id is not null;

create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid,
  action text not null,
  entity_type text not null,
  entity_id uuid not null,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now(),
  unique (user_id, endpoint)
);

-- Performance indexes
create index if not exists tasks_assigned_to_idx on public.tasks (assigned_to);
create index if not exists tasks_status_idx on public.tasks (status);
create index if not exists tasks_archived_at_idx on public.tasks (archived_at);
create index if not exists tasks_due_at_idx on public.tasks (due_at);
create index if not exists task_comments_task_id_idx on public.task_comments (task_id, created_at);
create index if not exists audit_log_created_at_idx on public.audit_log (created_at desc);

-- Helper functions
create or replace function public.current_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select p.role from public.profiles p where p.id = auth.uid()
$$;

create or replace function public.can_read_task(_task public.tasks)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    case
      when public.current_role() in ('admin', 'chief', 'lead') then true
      when _task.assigned_to = auth.uid() then true
      else false
    end
$$;

create or replace function public.enforce_task_update_rules()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  role_name text;
begin
  role_name := public.current_role();

  if role_name = 'engineer' then
    if old.assigned_to <> auth.uid() then
      raise exception 'engineer can update only assigned tasks';
    end if;

    if new.title <> old.title
      or coalesce(new.description, '') <> coalesce(old.description, '')
      or new.object_id <> old.object_id
      or new.priority <> old.priority
      or coalesce(new.due_at, 'epoch'::timestamptz) <> coalesce(old.due_at, 'epoch'::timestamptz)
      or new.created_by <> old.created_by
      or new.assigned_to <> old.assigned_to
      or coalesce(new.archived_at, 'epoch'::timestamptz) <> coalesce(old.archived_at, 'epoch'::timestamptz) then
      raise exception 'engineer can update only status fields';
    end if;
  end if;

  if new.status = 'in_progress' and old.accepted_at is null and new.accepted_at is null then
    new.accepted_at := now();
  end if;

  if new.status = 'done' and old.completed_at is null and new.completed_at is null then
    new.completed_at := now();
  end if;

  return new;
end;
$$;

drop trigger if exists trg_enforce_task_update_rules on public.tasks;
create trigger trg_enforce_task_update_rules
before update on public.tasks
for each row execute function public.enforce_task_update_rules();

create or replace function public.archive_done_tasks(hours_threshold int default 36)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  affected int;
begin
  update public.tasks
  set archived_at = now()
  where status = 'done'
    and archived_at is null
    and completed_at is not null
    and completed_at < now() - make_interval(hours => hours_threshold);

  get diagnostics affected = row_count;
  return affected;
end;
$$;

-- RLS
alter table public.profiles enable row level security;
alter table public.objects enable row level security;
alter table public.user_objects enable row level security;
alter table public.tasks enable row level security;
alter table public.task_comments enable row level security;
alter table public.audit_log enable row level security;
alter table public.push_subscriptions enable row level security;

-- profiles
create policy "profiles_select_self_or_admin"
  on public.profiles for select
  using (id = auth.uid() or public.current_role() in ('admin', 'chief', 'lead'));

-- objects
create policy "objects_select_by_role"
  on public.objects for select
  using (
    public.current_role() in ('admin', 'chief', 'lead')
    or exists (
      select 1
      from public.user_objects uo
      where uo.user_id = auth.uid() and uo.object_id = objects.id
    )
  );

create policy "objects_manage_admin_chief"
  on public.objects for all
  using (public.current_role() in ('admin', 'chief'))
  with check (public.current_role() in ('admin', 'chief'));

-- user_objects
create policy "user_objects_select_admin_or_self"
  on public.user_objects for select
  using (public.current_role() in ('admin', 'chief', 'lead') or user_id = auth.uid());

create policy "user_objects_manage_admin_chief"
  on public.user_objects for all
  using (public.current_role() in ('admin', 'chief'))
  with check (public.current_role() in ('admin', 'chief'));

-- tasks
create policy "tasks_select_role_scope"
  on public.tasks for select
  using (public.can_read_task(tasks));

create policy "tasks_insert_admin_chief_lead"
  on public.tasks for insert
  with check (public.current_role() in ('admin', 'chief', 'lead'));

create policy "tasks_update_admin_chief_lead_or_engineer_assignee"
  on public.tasks for update
  using (
    public.current_role() in ('admin', 'chief', 'lead')
    or (public.current_role() = 'engineer' and assigned_to = auth.uid())
  )
  with check (
    public.current_role() in ('admin', 'chief', 'lead')
    or (public.current_role() = 'engineer' and assigned_to = auth.uid())
  );

-- task_comments
create policy "task_comments_select_if_task_visible"
  on public.task_comments for select
  using (
    exists (
      select 1
      from public.tasks t
      where t.id = task_comments.task_id and public.can_read_task(t)
    )
  );

create policy "task_comments_insert_if_task_visible"
  on public.task_comments for insert
  with check (
    author_id = auth.uid()
    and exists (
      select 1
      from public.tasks t
      where t.id = task_comments.task_id and public.can_read_task(t)
    )
  );

-- audit_log
create policy "audit_log_select_admin_chief"
  on public.audit_log for select
  using (public.current_role() in ('admin', 'chief'));

create policy "audit_log_insert_authenticated"
  on public.audit_log for insert
  with check (auth.uid() is not null and actor_id = auth.uid());

-- push_subscriptions
create policy "push_subscriptions_owner_select"
  on public.push_subscriptions for select
  using (user_id = auth.uid());

create policy "push_subscriptions_owner_insert"
  on public.push_subscriptions for insert
  with check (user_id = auth.uid());

create policy "push_subscriptions_owner_update"
  on public.push_subscriptions for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "push_subscriptions_owner_delete"
  on public.push_subscriptions for delete
  using (user_id = auth.uid());

-- Optional schedule (requires pg_cron extension and proper permissions):
-- select cron.schedule(
--   'archive-done-tasks-hourly',
--   '5 * * * *',
--   $$select public.archive_done_tasks(36);$$
-- );
