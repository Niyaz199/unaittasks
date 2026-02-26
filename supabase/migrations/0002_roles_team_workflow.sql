-- Roles, team workflow and access model refactor

-- 1) Roles
alter table public.profiles
  drop constraint if exists profiles_role_check;

alter table public.profiles
  add constraint profiles_role_check
  check (role in ('admin', 'chief', 'lead', 'engineer', 'object_engineer', 'tech'));

-- 2) Objects: bind object engineer
alter table public.objects
  add column if not exists object_engineer_id uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'objects_object_engineer_id_fkey'
  ) then
    alter table public.objects
      add constraint objects_object_engineer_id_fkey
      foreign key (object_engineer_id) references public.profiles (id)
      on delete set null;
  end if;
end;
$$;

create index if not exists objects_object_engineer_id_idx on public.objects (object_engineer_id);

-- 3) Team members for grouped tasks
create table if not exists public.task_team_members (
  task_id uuid not null references public.tasks (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  added_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  primary key (task_id, user_id)
);

alter table public.task_team_members
  alter column added_by set default auth.uid();

create index if not exists task_team_members_user_id_idx on public.task_team_members (user_id);
create index if not exists task_team_members_task_id_idx on public.task_team_members (task_id);

-- 4) Helper functions
create or replace function public.current_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select p.role
  from public.profiles p
  where p.id = auth.uid()
$$;

create or replace function public.is_superuser()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_role() = 'admin'
$$;

create or replace function public.target_role(_user_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select p.role from public.profiles p where p.id = _user_id
$$;

create or replace function public.is_object_engineer_for_object(_object_id uuid, _user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.objects o
    where o.id = _object_id and o.object_engineer_id = _user_id
  )
$$;

create or replace function public.can_assign_to_role(assigner_role text, target_role text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if assigner_role is null or target_role is null then
    return false;
  end if;

  if assigner_role = 'admin' then
    return true;
  end if;

  if assigner_role = 'chief' then
    return target_role in ('lead', 'engineer', 'object_engineer', 'tech');
  elsif assigner_role = 'lead' then
    return target_role in ('engineer', 'object_engineer', 'tech');
  elsif assigner_role = 'engineer' then
    return target_role in ('engineer', 'object_engineer', 'tech');
  elsif assigner_role = 'object_engineer' then
    return target_role in ('lead', 'engineer', 'object_engineer', 'tech');
  else
    return false;
  end if;
end;
$$;

create or replace function public.can_assign_task(_assignee uuid, _object_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  role_name text;
  target text;
begin
  role_name := public.current_role();
  target := public.target_role(_assignee);

  if public.is_superuser() then
    return true;
  end if;

  if role_name is null or role_name = 'tech' then
    return false;
  end if;

  if not public.can_assign_to_role(role_name, target) then
    return false;
  end if;

  if role_name = 'object_engineer' and not public.is_object_engineer_for_object(_object_id, auth.uid()) then
    return false;
  end if;

  return true;
end;
$$;

create or replace function public.is_task_member(_task_id uuid, _user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.task_team_members tm
    where tm.task_id = _task_id and tm.user_id = _user_id
  )
$$;

create or replace function public.is_task_participant(_task public.tasks, _user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select (_task.assigned_to = _user_id or public.is_task_member(_task.id, _user_id))
$$;

create or replace function public.can_read_task(_task public.tasks)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  role_name text;
  uid uuid;
begin
  uid := auth.uid();
  role_name := public.current_role();

  if uid is null or role_name is null then
    return false;
  end if;

  if public.is_superuser() then
    return true;
  end if;

  if role_name = 'chief' then
    return true;
  elsif role_name in ('lead', 'engineer') then
    return (_task.created_by = uid or _task.assigned_to = uid or public.is_task_member(_task.id, uid));
  elsif role_name = 'object_engineer' then
    return public.is_object_engineer_for_object(_task.object_id, uid);
  elsif role_name = 'tech' then
    return (_task.assigned_to = uid or public.is_task_member(_task.id, uid));
  end if;

  return false;
end;
$$;

create or replace function public.can_manage_task_team(_task public.tasks)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  role_name text;
begin
  role_name := public.current_role();

  if role_name is null then
    return false;
  end if;

  if public.is_superuser() then
    return true;
  end if;

  if role_name in ('chief', 'lead', 'engineer') then
    return true;
  end if;

  if role_name = 'object_engineer' then
    return public.is_object_engineer_for_object(_task.object_id, auth.uid());
  end if;

  return false;
end;
$$;

create or replace function public.can_change_status(_task public.tasks)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_superuser() or public.is_task_participant(_task, auth.uid())
$$;

create or replace function public.can_update_task(_task public.tasks)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_superuser() or public.can_manage_task_team(_task) or public.is_task_participant(_task, auth.uid())
$$;

create or replace function public.can_create_task(_assignee uuid, _object_id uuid, _created_by uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  role_name text;
begin
  role_name := public.current_role();

  if role_name is null then
    return false;
  end if;

  if public.is_superuser() then
    return true;
  end if;

  if _created_by <> auth.uid() then
    return false;
  end if;

  if role_name not in ('chief', 'lead', 'engineer', 'object_engineer') then
    return false;
  end if;

  if role_name = 'object_engineer' and not public.is_object_engineer_for_object(_object_id, auth.uid()) then
    return false;
  end if;

  return public.can_assign_task(_assignee, _object_id);
end;
$$;

create or replace function public.enforce_task_update_rules()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  role_name text;
  status_changed boolean;
  assignee_changed boolean;
  non_status_changed boolean;
begin
  role_name := public.current_role();

  if role_name is null then
    raise exception 'forbidden';
  end if;

  status_changed := new.status is distinct from old.status;
  assignee_changed := new.assigned_to is distinct from old.assigned_to;
  non_status_changed :=
    new.title is distinct from old.title
    or coalesce(new.description, '') is distinct from coalesce(old.description, '')
    or new.object_id is distinct from old.object_id
    or new.priority is distinct from old.priority
    or coalesce(new.due_at, 'epoch'::timestamptz) is distinct from coalesce(old.due_at, 'epoch'::timestamptz)
    or new.created_by is distinct from old.created_by
    or coalesce(new.archived_at, 'epoch'::timestamptz) is distinct from coalesce(old.archived_at, 'epoch'::timestamptz);

  if public.is_superuser() then
    -- bypass role restrictions, preserve automatic status timestamps
    if status_changed and new.status = 'in_progress' and old.accepted_at is null and new.accepted_at is null then
      new.accepted_at := now();
    end if;
    if status_changed and new.status = 'done' and old.completed_at is null and new.completed_at is null then
      new.completed_at := now();
    end if;
    return new;
  end if;

  if role_name = 'tech' then
    if non_status_changed or assignee_changed then
      raise exception 'tech cannot modify task fields';
    end if;
    if status_changed and not public.can_change_status(old) then
      raise exception 'forbidden status change';
    end if;
  elsif role_name in ('chief', 'lead', 'engineer', 'object_engineer') then
    if role_name = 'object_engineer' and not public.is_object_engineer_for_object(new.object_id, auth.uid()) then
      raise exception 'object_engineer can update only tasks of own object';
    end if;

    if assignee_changed and not public.can_assign_task(new.assigned_to, new.object_id) then
      raise exception 'forbidden assignment';
    end if;

    if status_changed and not public.can_change_status(old) then
      raise exception 'forbidden status change';
    end if;
  else
    raise exception 'forbidden';
  end if;

  if status_changed and new.status = 'in_progress' and old.accepted_at is null and new.accepted_at is null then
    new.accepted_at := now();
  end if;

  if status_changed and new.status = 'done' and old.completed_at is null and new.completed_at is null then
    new.completed_at := now();
  end if;

  return new;
end;
$$;

drop trigger if exists trg_enforce_task_update_rules on public.tasks;
create trigger trg_enforce_task_update_rules
before update on public.tasks
for each row execute function public.enforce_task_update_rules();

-- 5) RLS policies
alter table public.task_team_members enable row level security;

-- profiles
drop policy if exists "profiles_select_self_or_admin" on public.profiles;
drop policy if exists "profiles_select_authenticated" on public.profiles;
create policy "profiles_select_authenticated"
  on public.profiles for select
  using (auth.uid() is not null);

-- objects
drop policy if exists "objects_select_by_role" on public.objects;
drop policy if exists "objects_manage_admin_chief" on public.objects;
drop policy if exists "objects_select_by_access" on public.objects;

create policy "objects_select_by_access"
  on public.objects for select
  using (
    public.is_superuser()
    or public.current_role() in ('chief', 'lead')
    or object_engineer_id = auth.uid()
    or exists (
      select 1
      from public.user_objects uo
      where uo.user_id = auth.uid() and uo.object_id = objects.id
    )
    or exists (
      select 1
      from public.tasks t
      where t.object_id = objects.id and public.can_read_task(t)
    )
  );

create policy "objects_manage_admin_chief"
  on public.objects for all
  using (public.is_superuser() or public.current_role() = 'chief')
  with check (public.is_superuser() or public.current_role() = 'chief');

-- user_objects
drop policy if exists "user_objects_select_admin_or_self" on public.user_objects;
drop policy if exists "user_objects_manage_admin_chief" on public.user_objects;

create policy "user_objects_select_admin_or_self"
  on public.user_objects for select
  using (public.is_superuser() or public.current_role() in ('chief', 'lead') or user_id = auth.uid());

create policy "user_objects_manage_admin_chief"
  on public.user_objects for all
  using (public.is_superuser() or public.current_role() = 'chief')
  with check (public.is_superuser() or public.current_role() = 'chief');

-- tasks
drop policy if exists "tasks_select_role_scope" on public.tasks;
drop policy if exists "tasks_insert_admin_chief_lead" on public.tasks;
drop policy if exists "tasks_update_admin_chief_lead_or_engineer_assignee" on public.tasks;
drop policy if exists "tasks_insert_by_matrix" on public.tasks;
drop policy if exists "tasks_update_by_matrix" on public.tasks;
drop policy if exists "tasks_delete_manage_roles" on public.tasks;

create policy "tasks_select_role_scope"
  on public.tasks for select
  using (public.can_read_task(tasks));

create policy "tasks_insert_by_matrix"
  on public.tasks for insert
  with check (public.can_create_task(assigned_to, object_id, created_by));

create policy "tasks_update_by_matrix"
  on public.tasks for update
  using (public.can_update_task(tasks))
  with check (public.can_update_task(tasks));

create policy "tasks_delete_manage_roles"
  on public.tasks for delete
  using (
    public.is_superuser()
    or public.current_role() in ('chief', 'lead', 'engineer', 'object_engineer')
  );

-- task comments
drop policy if exists "task_comments_select_if_task_visible" on public.task_comments;
drop policy if exists "task_comments_insert_if_task_visible" on public.task_comments;

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

-- task team members
drop policy if exists "task_team_members_select_if_task_visible" on public.task_team_members;
drop policy if exists "task_team_members_insert_if_manage_task" on public.task_team_members;
drop policy if exists "task_team_members_delete_if_manage_task" on public.task_team_members;

create policy "task_team_members_select_if_task_visible"
  on public.task_team_members for select
  using (
    exists (
      select 1
      from public.tasks t
      where t.id = task_team_members.task_id and public.can_read_task(t)
    )
  );

create policy "task_team_members_insert_if_manage_task"
  on public.task_team_members for insert
  with check (
    exists (
      select 1
      from public.tasks t
      where t.id = task_team_members.task_id and public.can_manage_task_team(t)
    )
  );

create policy "task_team_members_delete_if_manage_task"
  on public.task_team_members for delete
  using (
    exists (
      select 1
      from public.tasks t
      where t.id = task_team_members.task_id and public.can_manage_task_team(t)
    )
  );

-- audit log
drop policy if exists "audit_log_select_admin_chief" on public.audit_log;
drop policy if exists "audit_log_insert_authenticated" on public.audit_log;

create policy "audit_log_select_admin_chief"
  on public.audit_log for select
  using (public.is_superuser() or public.current_role() = 'chief');

create policy "audit_log_insert_authenticated"
  on public.audit_log for insert
  with check (auth.uid() is not null and actor_id = auth.uid());
