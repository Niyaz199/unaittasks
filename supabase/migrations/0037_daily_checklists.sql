create table if not exists public.daily_checklist_templates (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  role_snapshot text not null check (role_snapshot in ('lead', 'engineer', 'object_engineer')),
  version integer not null default 1 check (version > 0),
  name text not null,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null,
  archived_at timestamptz
);

create unique index if not exists uq_daily_checklist_templates_active_profile
  on public.daily_checklist_templates(profile_id)
  where is_active and archived_at is null;

create index if not exists idx_daily_checklist_templates_profile
  on public.daily_checklist_templates(profile_id, created_at desc);

create table if not exists public.daily_checklist_template_items (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.daily_checklist_templates(id) on delete cascade,
  sort_order integer not null default 1 check (sort_order > 0),
  title text not null,
  description text,
  schedule_type text not null check (schedule_type in ('daily', 'weekday', 'month_days', 'month_range')),
  schedule_config jsonb not null default '{}'::jsonb,
  schedule_label text not null,
  is_required boolean not null default true,
  allow_task_escalation boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_daily_checklist_template_items_template
  on public.daily_checklist_template_items(template_id, sort_order, created_at);

create table if not exists public.daily_checklist_runs (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  role_snapshot text not null check (role_snapshot in ('lead', 'engineer', 'object_engineer')),
  operational_date date not null,
  template_id uuid references public.daily_checklist_templates(id) on delete set null,
  template_name text not null,
  status text not null default 'in_progress' check (status in ('in_progress', 'completed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

create unique index if not exists uq_daily_checklist_runs_profile_date
  on public.daily_checklist_runs(profile_id, operational_date);

create index if not exists idx_daily_checklist_runs_operational_date
  on public.daily_checklist_runs(operational_date desc, profile_id);

create table if not exists public.daily_checklist_item_runs (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.daily_checklist_runs(id) on delete cascade,
  template_item_id uuid references public.daily_checklist_template_items(id) on delete set null,
  sort_order integer not null default 1 check (sort_order > 0),
  title text not null,
  description text,
  schedule_type text not null check (schedule_type in ('daily', 'weekday', 'month_days', 'month_range')),
  schedule_config jsonb not null default '{}'::jsonb,
  schedule_label text not null,
  is_required boolean not null default true,
  allow_task_escalation boolean not null default false,
  status text not null default 'pending' check (status in ('pending', 'done', 'problem')),
  comment text,
  linked_task_id uuid references public.tasks(id) on delete set null,
  linked_object_id uuid references public.objects(id) on delete set null,
  completed_at timestamptz,
  completed_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_daily_checklist_item_runs_run
  on public.daily_checklist_item_runs(run_id, sort_order, created_at);

create index if not exists idx_daily_checklist_item_runs_status
  on public.daily_checklist_item_runs(status, created_at desc);

create index if not exists idx_daily_checklist_item_runs_linked_task
  on public.daily_checklist_item_runs(linked_task_id)
  where linked_task_id is not null;

create table if not exists public.daily_checklist_item_attachments (
  id uuid primary key default gen_random_uuid(),
  item_run_id uuid not null references public.daily_checklist_item_runs(id) on delete cascade,
  storage_path text not null,
  file_name text not null,
  mime_type text not null,
  size_bytes bigint not null,
  uploaded_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  cleanup_after timestamptz not null default (now() + interval '30 days'),
  deleted_at timestamptz
);

create index if not exists idx_daily_checklist_item_attachments_item_run
  on public.daily_checklist_item_attachments(item_run_id, created_at);

create index if not exists idx_daily_checklist_item_attachments_cleanup
  on public.daily_checklist_item_attachments(cleanup_after)
  where deleted_at is null;

create or replace function public.can_access_daily_checklists()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null
    and public.current_role() in ('admin', 'chief', 'lead', 'engineer', 'object_engineer')
$$;

create or replace function public.can_manage_daily_checklist_templates()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null
    and public.current_role() in ('admin', 'chief')
$$;

create or replace function public.daily_checklist_profile_role(_profile_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select p.role
  from public.profiles p
  where p.id = _profile_id
$$;

create or replace function public.can_view_daily_checklist_control()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null
    and public.current_role() in ('admin', 'chief', 'lead')
$$;

create or replace function public.can_read_daily_checklist_template(_template public.daily_checklist_templates)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.can_manage_daily_checklist_templates()
    or (
      public.can_access_daily_checklists()
      and _template.profile_id = auth.uid()
      and _template.is_active is true
      and _template.archived_at is null
    )
$$;

create or replace function public.can_read_daily_checklist_run(_run public.daily_checklist_runs)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.can_view_daily_checklist_control()
    or _run.profile_id = auth.uid()
$$;

create or replace function public.can_write_daily_checklist_run(_run public.daily_checklist_runs)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.can_access_daily_checklists()
    and _run.profile_id = auth.uid()
$$;

create or replace function public.can_write_daily_checklist_item_run(_item public.daily_checklist_item_runs)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.daily_checklist_runs r
    where r.id = _item.run_id
      and public.can_write_daily_checklist_run(r)
  )
$$;

alter table public.daily_checklist_templates enable row level security;
alter table public.daily_checklist_template_items enable row level security;
alter table public.daily_checklist_runs enable row level security;
alter table public.daily_checklist_item_runs enable row level security;
alter table public.daily_checklist_item_attachments enable row level security;

drop policy if exists "daily_checklist_templates_select" on public.daily_checklist_templates;
create policy "daily_checklist_templates_select"
  on public.daily_checklist_templates for select
  using (public.can_read_daily_checklist_template(daily_checklist_templates));

drop policy if exists "daily_checklist_templates_insert" on public.daily_checklist_templates;
create policy "daily_checklist_templates_insert"
  on public.daily_checklist_templates for insert
  with check (
    public.can_manage_daily_checklist_templates()
    and created_by = auth.uid()
    and public.daily_checklist_profile_role(profile_id) in ('lead', 'engineer', 'object_engineer')
    and role_snapshot = public.daily_checklist_profile_role(profile_id)
  );

drop policy if exists "daily_checklist_templates_update" on public.daily_checklist_templates;
create policy "daily_checklist_templates_update"
  on public.daily_checklist_templates for update
  using (public.can_manage_daily_checklist_templates())
  with check (
    public.can_manage_daily_checklist_templates()
    and public.daily_checklist_profile_role(profile_id) in ('lead', 'engineer', 'object_engineer')
    and role_snapshot = public.daily_checklist_profile_role(profile_id)
  );

drop policy if exists "daily_checklist_template_items_select" on public.daily_checklist_template_items;
create policy "daily_checklist_template_items_select"
  on public.daily_checklist_template_items for select
  using (
    exists (
      select 1
      from public.daily_checklist_templates t
      where t.id = daily_checklist_template_items.template_id
        and public.can_read_daily_checklist_template(t)
    )
  );

drop policy if exists "daily_checklist_template_items_insert" on public.daily_checklist_template_items;
create policy "daily_checklist_template_items_insert"
  on public.daily_checklist_template_items for insert
  with check (
    exists (
      select 1
      from public.daily_checklist_templates t
      where t.id = daily_checklist_template_items.template_id
        and public.can_manage_daily_checklist_templates()
    )
  );

drop policy if exists "daily_checklist_template_items_update" on public.daily_checklist_template_items;
create policy "daily_checklist_template_items_update"
  on public.daily_checklist_template_items for update
  using (
    exists (
      select 1
      from public.daily_checklist_templates t
      where t.id = daily_checklist_template_items.template_id
        and public.can_manage_daily_checklist_templates()
    )
  )
  with check (
    exists (
      select 1
      from public.daily_checklist_templates t
      where t.id = daily_checklist_template_items.template_id
        and public.can_manage_daily_checklist_templates()
    )
  );

drop policy if exists "daily_checklist_template_items_delete" on public.daily_checklist_template_items;
create policy "daily_checklist_template_items_delete"
  on public.daily_checklist_template_items for delete
  using (
    exists (
      select 1
      from public.daily_checklist_templates t
      where t.id = daily_checklist_template_items.template_id
        and public.can_manage_daily_checklist_templates()
    )
  );

drop policy if exists "daily_checklist_runs_select" on public.daily_checklist_runs;
create policy "daily_checklist_runs_select"
  on public.daily_checklist_runs for select
  using (public.can_read_daily_checklist_run(daily_checklist_runs));

drop policy if exists "daily_checklist_runs_insert" on public.daily_checklist_runs;
create policy "daily_checklist_runs_insert"
  on public.daily_checklist_runs for insert
  with check (
    public.can_access_daily_checklists()
    and profile_id = auth.uid()
    and role_snapshot = public.current_role()
  );

drop policy if exists "daily_checklist_runs_update" on public.daily_checklist_runs;
create policy "daily_checklist_runs_update"
  on public.daily_checklist_runs for update
  using (public.can_write_daily_checklist_run(daily_checklist_runs))
  with check (public.can_write_daily_checklist_run(daily_checklist_runs));

drop policy if exists "daily_checklist_item_runs_select" on public.daily_checklist_item_runs;
create policy "daily_checklist_item_runs_select"
  on public.daily_checklist_item_runs for select
  using (
    exists (
      select 1
      from public.daily_checklist_runs r
      where r.id = daily_checklist_item_runs.run_id
        and public.can_read_daily_checklist_run(r)
    )
  );

drop policy if exists "daily_checklist_item_runs_insert" on public.daily_checklist_item_runs;
create policy "daily_checklist_item_runs_insert"
  on public.daily_checklist_item_runs for insert
  with check (
    exists (
      select 1
      from public.daily_checklist_runs r
      where r.id = daily_checklist_item_runs.run_id
        and public.can_write_daily_checklist_run(r)
    )
  );

drop policy if exists "daily_checklist_item_runs_update" on public.daily_checklist_item_runs;
create policy "daily_checklist_item_runs_update"
  on public.daily_checklist_item_runs for update
  using (public.can_write_daily_checklist_item_run(daily_checklist_item_runs))
  with check (public.can_write_daily_checklist_item_run(daily_checklist_item_runs));

drop policy if exists "daily_checklist_item_attachments_select" on public.daily_checklist_item_attachments;
create policy "daily_checklist_item_attachments_select"
  on public.daily_checklist_item_attachments for select
  using (
    exists (
      select 1
      from public.daily_checklist_item_runs ir
      join public.daily_checklist_runs r on r.id = ir.run_id
      where ir.id = daily_checklist_item_attachments.item_run_id
        and public.can_read_daily_checklist_run(r)
    )
  );

drop policy if exists "daily_checklist_item_attachments_insert" on public.daily_checklist_item_attachments;
create policy "daily_checklist_item_attachments_insert"
  on public.daily_checklist_item_attachments for insert
  with check (
    uploaded_by = auth.uid()
    and exists (
      select 1
      from public.daily_checklist_item_runs ir
      where ir.id = daily_checklist_item_attachments.item_run_id
        and public.can_write_daily_checklist_item_run(ir)
    )
  );

drop policy if exists "daily_checklist_item_attachments_delete" on public.daily_checklist_item_attachments;
create policy "daily_checklist_item_attachments_delete"
  on public.daily_checklist_item_attachments for delete
  using (
    uploaded_by = auth.uid()
    or public.can_manage_daily_checklist_templates()
  );

-- Bucket "daily-checklist-attachments" должен быть создан вручную через Supabase Dashboard или CLI.
drop policy if exists "daily_checklist_storage_select" on storage.objects;
create policy "daily_checklist_storage_select" on storage.objects
  for select using (
    bucket_id = 'daily-checklist-attachments'
    and auth.role() = 'authenticated'
    and exists (
      select 1
      from public.daily_checklist_item_attachments a
      join public.daily_checklist_item_runs ir on ir.id = a.item_run_id
      join public.daily_checklist_runs r on r.id = ir.run_id
      where a.storage_path = name
        and a.deleted_at is null
        and public.can_read_daily_checklist_run(r)
    )
  );

drop policy if exists "daily_checklist_storage_insert" on storage.objects;
create policy "daily_checklist_storage_insert" on storage.objects
  for insert with check (
    bucket_id = 'daily-checklist-attachments'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "daily_checklist_storage_delete" on storage.objects;
create policy "daily_checklist_storage_delete" on storage.objects
  for delete using (
    bucket_id = 'daily-checklist-attachments'
    and auth.role() = 'authenticated'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.can_manage_daily_checklist_templates()
    )
  );
