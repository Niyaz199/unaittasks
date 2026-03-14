-- PPR tasks, work items, comments and attachments

create table if not exists public.ppr_tasks (
  id uuid primary key default gen_random_uuid(),
  object_id uuid not null references public.objects (id) on delete cascade,
  system_id uuid not null references public.ppr_systems (id) on delete restrict,
  subsystem_id uuid not null references public.ppr_subsystems (id) on delete restrict,
  equipment_id uuid not null references public.ppr_equipment (id) on delete restrict,
  responsible_user_id uuid not null references public.profiles (id),
  assignee_id uuid references public.profiles (id),
  planned_for date not null,
  completed_at timestamptz,
  closed_at timestamptz,
  cancelled_at timestamptz,
  cancelled_by uuid references public.profiles (id),
  status text not null default 'new',
  is_overdue boolean not null default false,
  is_rescheduled boolean not null default false,
  general_comment text,
  cancel_reason text,
  created_at timestamptz not null default now(),
  constraint ppr_tasks_status_check check (status in ('new', 'in_progress', 'done', 'closed', 'cancelled')),
  constraint ppr_tasks_cancelled_check check ((status <> 'cancelled') or cancelled_at is not null)
);

create table if not exists public.ppr_task_work_items (
  id uuid primary key default gen_random_uuid(),
  object_id uuid not null references public.objects (id) on delete cascade,
  task_id uuid not null references public.ppr_tasks (id) on delete cascade,
  assignment_id uuid not null references public.ppr_equipment_work_assignments (id) on delete restrict,
  template_id uuid not null references public.ppr_work_templates (id) on delete restrict,
  plan_item_id uuid references public.ppr_month_plan_items (id) on delete set null,
  title_snapshot text not null,
  description_snapshot text,
  methodology_snapshot text,
  checklist_snapshot jsonb not null,
  norm_hours_snapshot numeric(10,2),
  sort_order integer not null,
  constraint ppr_task_work_items_task_assignment_key unique (task_id, assignment_id),
  constraint ppr_task_work_items_task_sort_key unique (task_id, sort_order),
  constraint ppr_task_work_items_checklist_snapshot_check check (jsonb_typeof(checklist_snapshot) = 'array')
);

create table if not exists public.ppr_task_comments (
  id uuid primary key default gen_random_uuid(),
  object_id uuid not null references public.objects (id) on delete cascade,
  task_id uuid not null references public.ppr_tasks (id) on delete cascade,
  author_id uuid not null references public.profiles (id),
  body text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.ppr_task_attachments (
  id uuid primary key default gen_random_uuid(),
  object_id uuid not null references public.objects (id) on delete cascade,
  task_id uuid not null references public.ppr_tasks (id) on delete cascade,
  comment_id uuid references public.ppr_task_comments (id) on delete cascade,
  storage_path text not null,
  file_name text not null,
  mime_type text not null,
  size_bytes bigint not null,
  uploaded_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  constraint ppr_task_attachments_storage_path_key unique (storage_path)
);

alter table public.ppr_month_plan_items
  add constraint ppr_month_plan_items_task_id_fkey
  foreign key (task_id) references public.ppr_tasks (id) on delete set null;

create index if not exists idx_ppr_tasks_object_id on public.ppr_tasks (object_id);
create index if not exists idx_ppr_tasks_system_id on public.ppr_tasks (system_id);
create index if not exists idx_ppr_tasks_equipment_id on public.ppr_tasks (equipment_id);
create index if not exists idx_ppr_tasks_responsible_user_id on public.ppr_tasks (responsible_user_id);
create index if not exists idx_ppr_tasks_assignee_id on public.ppr_tasks (assignee_id);
create index if not exists idx_ppr_tasks_status on public.ppr_tasks (status);
create index if not exists idx_ppr_tasks_planned_for on public.ppr_tasks (planned_for);
create index if not exists idx_ppr_tasks_closed_at on public.ppr_tasks (closed_at);
create index if not exists idx_ppr_tasks_cancelled_at on public.ppr_tasks (cancelled_at);
create unique index if not exists ppr_tasks_active_equipment_planned_for_uidx
  on public.ppr_tasks (equipment_id, planned_for)
  where status in ('new', 'in_progress', 'done');

create index if not exists idx_ppr_task_work_items_object_id on public.ppr_task_work_items (object_id);
create index if not exists idx_ppr_task_work_items_task_id on public.ppr_task_work_items (task_id);
create index if not exists idx_ppr_task_work_items_assignment_id on public.ppr_task_work_items (assignment_id);
create index if not exists idx_ppr_task_work_items_plan_item_id on public.ppr_task_work_items (plan_item_id);

create index if not exists idx_ppr_task_comments_object_id on public.ppr_task_comments (object_id);
create index if not exists idx_ppr_task_comments_task_id on public.ppr_task_comments (task_id);
create index if not exists idx_ppr_task_comments_author_id on public.ppr_task_comments (author_id);
create index if not exists idx_ppr_task_comments_created_at on public.ppr_task_comments (created_at);

create index if not exists idx_ppr_task_attachments_object_id on public.ppr_task_attachments (object_id);
create index if not exists idx_ppr_task_attachments_task_id on public.ppr_task_attachments (task_id);
create index if not exists idx_ppr_task_attachments_comment_id on public.ppr_task_attachments (comment_id);
create index if not exists idx_ppr_task_attachments_uploaded_by on public.ppr_task_attachments (uploaded_by);

create or replace function public.ppr_is_active_task_status(_status text)
returns boolean
language sql
immutable
as $$
  select _status in ('new', 'in_progress', 'done')
$$;

create or replace function public.ppr_validate_task_aggregation(
  _equipment_id uuid,
  _planned_for date,
  _task_id uuid default null
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select not exists (
    select 1
    from public.ppr_tasks t
    where t.equipment_id = _equipment_id
      and t.planned_for = _planned_for
      and public.ppr_is_active_task_status(t.status)
      and (_task_id is null or t.id <> _task_id)
  )
$$;

create or replace function public.ppr_can_read_task(_task public.ppr_tasks)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  uid uuid;
  role_name text;
begin
  uid := auth.uid();
  role_name := public.ppr_current_role();

  if uid is null or role_name is null then
    return false;
  end if;

  if role_name in ('admin', 'chief') then
    return true;
  end if;

  if role_name in ('lead', 'object_engineer') then
    return public.ppr_has_object_access(_task.object_id);
  end if;

  if role_name = 'engineer' then
    return _task.responsible_user_id = uid or _task.assignee_id = uid;
  end if;

  if role_name = 'tech' then
    return _task.assignee_id = uid;
  end if;

  return false;
end;
$$;

create or replace function public.ppr_can_assign_executor(_task public.ppr_tasks)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  uid uuid;
  role_name text;
begin
  uid := auth.uid();
  role_name := public.ppr_current_role();

  if uid is null or role_name is null then
    return false;
  end if;

  if role_name in ('admin', 'chief') then
    return true;
  end if;

  if role_name in ('lead', 'object_engineer') then
    return public.ppr_has_object_access(_task.object_id);
  end if;

  if role_name = 'engineer' then
    return _task.responsible_user_id = uid;
  end if;

  return false;
end;
$$;

create or replace function public.ppr_can_close_task(_task public.ppr_tasks)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  uid uuid;
  role_name text;
begin
  uid := auth.uid();
  role_name := public.ppr_current_role();

  if uid is null or role_name is null then
    return false;
  end if;

  if role_name in ('admin', 'chief') then
    return true;
  end if;

  if role_name in ('lead', 'object_engineer') then
    return public.ppr_has_object_access(_task.object_id);
  end if;

  if role_name = 'engineer' then
    return _task.responsible_user_id = uid;
  end if;

  return false;
end;
$$;

create or replace function public.ppr_can_execute_task(_task public.ppr_tasks)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  uid uuid;
  role_name text;
begin
  uid := auth.uid();
  role_name := public.ppr_current_role();

  if uid is null or role_name is null then
    return false;
  end if;

  if role_name in ('admin', 'chief') then
    return true;
  end if;

  if role_name in ('lead', 'object_engineer') then
    return public.ppr_has_object_access(_task.object_id);
  end if;

  if role_name = 'engineer' then
    return _task.responsible_user_id = uid or _task.assignee_id = uid;
  end if;

  if role_name = 'tech' then
    return _task.assignee_id = uid;
  end if;

  return false;
end;
$$;

create or replace function public.ppr_prepare_task_row()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.ppr_validate_task_aggregation(new.equipment_id, new.planned_for, case when tg_op = 'UPDATE' then new.id else null end) then
    raise exception 'duplicate active ppr task for equipment and planned_for';
  end if;

  if new.cancelled_by is not null and new.cancelled_at is null then
    new.cancelled_at := now();
  end if;

  if new.status = 'cancelled' and new.cancelled_at is null then
    raise exception 'cancelled_at is required for cancelled ppr task';
  end if;

  if new.status = 'done' and new.completed_at is null then
    new.completed_at := now();
  end if;

  if new.status = 'closed' and new.closed_at is null then
    new.closed_at := now();
  end if;

  if new.status <> 'cancelled' then
    new.cancelled_at := null;
    new.cancelled_by := null;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_ppr_prepare_task_row on public.ppr_tasks;
create trigger trg_ppr_prepare_task_row
before insert or update on public.ppr_tasks
for each row execute function public.ppr_prepare_task_row();

alter table public.ppr_tasks enable row level security;
alter table public.ppr_task_work_items enable row level security;
alter table public.ppr_task_comments enable row level security;
alter table public.ppr_task_attachments enable row level security;

drop policy if exists "ppr_tasks_select_readable" on public.ppr_tasks;
drop policy if exists "ppr_tasks_update_allowed" on public.ppr_tasks;

create policy "ppr_tasks_select_readable"
  on public.ppr_tasks for select
  using (public.ppr_can_read_task(ppr_tasks));

create policy "ppr_tasks_update_allowed"
  on public.ppr_tasks for update
  using (
    public.ppr_can_assign_executor(ppr_tasks)
    or public.ppr_can_close_task(ppr_tasks)
    or public.ppr_can_execute_task(ppr_tasks)
  )
  with check (
    public.ppr_can_assign_executor(ppr_tasks)
    or public.ppr_can_close_task(ppr_tasks)
    or public.ppr_can_execute_task(ppr_tasks)
  );

drop policy if exists "ppr_task_work_items_select_by_parent_task" on public.ppr_task_work_items;

create policy "ppr_task_work_items_select_by_parent_task"
  on public.ppr_task_work_items for select
  using (
    exists (
      select 1
      from public.ppr_tasks t
      where t.id = task_id
        and public.ppr_can_read_task(t)
    )
  );

drop policy if exists "ppr_task_comments_select_by_parent_task" on public.ppr_task_comments;
drop policy if exists "ppr_task_comments_insert_by_parent_task" on public.ppr_task_comments;

create policy "ppr_task_comments_select_by_parent_task"
  on public.ppr_task_comments for select
  using (
    exists (
      select 1
      from public.ppr_tasks t
      where t.id = task_id
        and public.ppr_can_read_task(t)
    )
  );

create policy "ppr_task_comments_insert_by_parent_task"
  on public.ppr_task_comments for insert
  with check (
    exists (
      select 1
      from public.ppr_tasks t
      where t.id = task_id
        and public.ppr_can_execute_task(t)
    )
  );

drop policy if exists "ppr_task_attachments_select_by_parent_task" on public.ppr_task_attachments;
drop policy if exists "ppr_task_attachments_insert_by_parent_task" on public.ppr_task_attachments;
drop policy if exists "ppr_task_attachments_delete_manage_roles" on public.ppr_task_attachments;

create policy "ppr_task_attachments_select_by_parent_task"
  on public.ppr_task_attachments for select
  using (
    exists (
      select 1
      from public.ppr_tasks t
      where t.id = task_id
        and public.ppr_can_read_task(t)
    )
  );

create policy "ppr_task_attachments_insert_by_parent_task"
  on public.ppr_task_attachments for insert
  with check (
    exists (
      select 1
      from public.ppr_tasks t
      where t.id = task_id
        and public.ppr_can_execute_task(t)
    )
  );

create policy "ppr_task_attachments_delete_manage_roles"
  on public.ppr_task_attachments for delete
  using (
    exists (
      select 1
      from public.ppr_tasks t
      where t.id = task_id
        and (public.ppr_can_close_task(t) or public.ppr_can_assign_executor(t))
    )
  );
