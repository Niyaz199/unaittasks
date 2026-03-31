create or replace function public.enforce_profile_update_rules()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.full_name := btrim(coalesce(new.full_name, ''));

  if new.full_name = '' then
    raise exception 'full_name required';
  end if;

  if new.id is distinct from old.id then
    raise exception 'profile id is immutable';
  end if;

  if new.created_at is distinct from old.created_at then
    raise exception 'profile created_at is immutable';
  end if;

  if old.id = auth.uid() and new.role is distinct from old.role then
    raise exception 'cannot change own role';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_enforce_profile_update_rules on public.profiles;
create trigger trg_enforce_profile_update_rules
before update on public.profiles
for each row execute function public.enforce_profile_update_rules();

drop policy if exists "profiles_update_self_name" on public.profiles;
create policy "profiles_update_self_name"
  on public.profiles for update
  using (id = auth.uid())
  with check (id = auth.uid());
