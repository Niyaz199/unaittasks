-- Fix: engineer can create tasks for accessible objects; tech cannot create tasks
-- Adds object-access check for engineer in can_create_task.
-- Also hardens objects SELECT policy to explicitly include engineer access paths.

-- 1) Helper: check if current user has access to an object
--    (via user_objects assignment OR being object_engineer_id)
create or replace function public.has_object_access(_object_id uuid, _user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_objects uo
    where uo.object_id = _object_id and uo.user_id = _user_id
  )
  or exists (
    select 1
    from public.objects o
    where o.id = _object_id and o.object_engineer_id = _user_id
  )
$$;

-- 2) Update can_create_task: engineer must have access to the object
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

  -- admin bypasses all checks
  if public.is_superuser() then
    return true;
  end if;

  -- created_by must be the authenticated user
  if _created_by <> auth.uid() then
    return false;
  end if;

  -- tech is explicitly forbidden from creating tasks
  if role_name = 'tech' then
    return false;
  end if;

  -- only these roles can create tasks
  if role_name not in ('chief', 'lead', 'engineer', 'object_engineer') then
    return false;
  end if;

  -- object_engineer: must be engineer for that specific object
  if role_name = 'object_engineer' then
    if not public.is_object_engineer_for_object(_object_id, auth.uid()) then
      return false;
    end if;
  end if;

  -- engineer: must have access to the object (via user_objects or object_engineer_id)
  if role_name = 'engineer' then
    if not public.has_object_access(_object_id, auth.uid()) then
      return false;
    end if;
  end if;

  return public.can_assign_task(_assignee, _object_id);
end;
$$;

-- 3) Refresh objects SELECT policy to be explicit about engineer access paths
--    (no functional change for already-correct cases, just makes intent clear)
drop policy if exists "objects_select_by_access" on public.objects;

create policy "objects_select_by_access"
  on public.objects for select
  using (
    -- admin
    public.is_superuser()
    -- chief and lead see all objects
    or public.current_role() in ('chief', 'lead')
    -- object engineer sees their own objects
    or object_engineer_id = auth.uid()
    -- engineer/tech assigned to this object via user_objects
    or exists (
      select 1
      from public.user_objects uo
      where uo.user_id = auth.uid() and uo.object_id = objects.id
    )
    -- any role that can read a task for this object (e.g. tech assigned to a task)
    or exists (
      select 1
      from public.tasks t
      where t.object_id = objects.id and public.can_read_task(t)
    )
  );

-- 4) Ensure user_objects SELECT allows self-access (already correct, re-stated for clarity)
drop policy if exists "user_objects_select_admin_or_self" on public.user_objects;

create policy "user_objects_select_admin_or_self"
  on public.user_objects for select
  using (
    public.is_superuser()
    or public.current_role() in ('chief', 'lead')
    or user_id = auth.uid()
  );
