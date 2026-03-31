create or replace function public.can_manage_object_room(_object_id uuid)
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

  if role_name in ('admin', 'chief') then
    return true;
  end if;

  if role_name not in ('lead', 'engineer', 'object_engineer') then
    return false;
  end if;

  return public.has_object_access(_object_id, uid);
end;
$$;
