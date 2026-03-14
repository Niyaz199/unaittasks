create or replace function public.ppr_generate_inventory_no(_object_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  candidate text;
begin
  loop
    candidate :=
      'PPR-' ||
      upper(replace(left(_object_id::text, 8), '-', '')) ||
      '-' ||
      to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS') ||
      '-' ||
      upper(substring(encode(extensions.gen_random_bytes(2), 'hex') from 1 for 4));

    exit when not exists (
      select 1
      from public.ppr_equipment e
      where e.inventory_no = candidate
    );
  end loop;

  return candidate;
end;
$$;

create or replace function public.ppr_generate_qr_token()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  candidate text;
begin
  loop
    candidate := encode(extensions.gen_random_bytes(16), 'hex');

    exit when not exists (
      select 1
      from public.ppr_equipment_qr_codes q
      where q.qr_token = candidate
    );
  end loop;

  return candidate;
end;
$$;
