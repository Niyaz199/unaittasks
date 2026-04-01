-- Align task assignment matrix and target object-access checks with app helpers.

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
  elsif assigner_role in ('engineer', 'object_engineer') then
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

  if not public.has_object_access(_object_id, _assignee) then
    return false;
  end if;

  if role_name = 'object_engineer' and not public.is_object_engineer_for_object(_object_id, auth.uid()) then
    return false;
  end if;

  return true;
end;
$$;
