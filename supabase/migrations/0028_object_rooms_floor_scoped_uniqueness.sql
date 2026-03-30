create or replace function public.normalize_object_room_name(_name text)
returns text
language sql
immutable
returns null on null input
as $$
  select lower(btrim(regexp_replace(_name, '\s+', ' ', 'g')))
$$;

do $$
declare
  null_floor_count integer;
  invalid_name_count integer;
  duplicate_group_count integer;
  duplicate_examples text;
begin
  select count(*)
  into null_floor_count
  from public.object_rooms
  where floor_id is null;

  if null_floor_count > 0 then
    raise exception
      'Preflight failed: найдено % помещений без floor_id. Сначала заполните floor_id для всех object_rooms.',
      null_floor_count;
  end if;

  select count(*)
  into invalid_name_count
  from public.object_rooms
  where public.normalize_object_room_name(name) is null
     or public.normalize_object_room_name(name) = '';

  if invalid_name_count > 0 then
    raise exception
      'Preflight failed: найдено % помещений с пустым или битым name после нормализации.',
      invalid_name_count;
  end if;

  with duplicate_groups as (
    select
      object_id,
      floor_id,
      public.normalize_object_room_name(name) as normalized_name,
      array_agg(name order by created_at, id) as source_names
    from public.object_rooms
    group by object_id, floor_id, public.normalize_object_room_name(name)
    having count(*) > 1
  )
  select
    count(*),
    string_agg(
      format(
        'object_id=%s floor_id=%s normalized_name=%s names=%s',
        object_id,
        floor_id,
        normalized_name,
        array_to_string(source_names, ' | ')
      ),
      E'\n'
      order by object_id, floor_id, normalized_name
    )
  into duplicate_group_count, duplicate_examples
  from duplicate_groups;

  if duplicate_group_count > 0 then
    raise exception
      'Preflight failed: найдено % конфликтующих групп по новой уникальности object_id + floor_id + normalized(name). Примеры:%',
      duplicate_group_count,
      E'\n' || coalesce(duplicate_examples, '');
  end if;
end;
$$;

alter table public.object_rooms
  drop constraint if exists object_rooms_object_id_name_key;

drop index if exists public.object_rooms_object_floor_normalized_name_unique;

create unique index object_rooms_object_floor_normalized_name_unique
  on public.object_rooms (
    object_id,
    floor_id,
    public.normalize_object_room_name(name)
  );
