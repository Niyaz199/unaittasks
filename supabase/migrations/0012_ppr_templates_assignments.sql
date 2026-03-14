-- PPR templates, checklist, template attachments and assignments

create table if not exists public.ppr_work_templates (
  id uuid primary key default gen_random_uuid(),
  object_id uuid not null references public.objects (id) on delete cascade,
  subsystem_id uuid not null references public.ppr_subsystems (id) on delete cascade,
  name text not null,
  description text,
  period_months integer not null,
  base_start_date date not null,
  norm_hours numeric(10,2),
  methodology text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint ppr_work_templates_object_subsystem_name_key unique (object_id, subsystem_id, name),
  constraint ppr_work_templates_period_months_check check (period_months > 0)
);

create table if not exists public.ppr_work_checklist_items (
  id uuid primary key default gen_random_uuid(),
  object_id uuid not null references public.objects (id) on delete cascade,
  template_id uuid not null references public.ppr_work_templates (id) on delete cascade,
  sort_order integer not null,
  title text not null,
  description text,
  constraint ppr_work_checklist_items_template_sort_key unique (template_id, sort_order)
);

create table if not exists public.ppr_equipment_work_assignments (
  id uuid primary key default gen_random_uuid(),
  object_id uuid not null references public.objects (id) on delete cascade,
  equipment_id uuid not null references public.ppr_equipment (id) on delete cascade,
  template_id uuid not null references public.ppr_work_templates (id) on delete cascade,
  start_date date not null,
  period_months integer not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint ppr_equipment_work_assignments_equipment_template_key unique (equipment_id, template_id),
  constraint ppr_equipment_work_assignments_period_months_check check (period_months > 0)
);

create table if not exists public.ppr_work_template_attachments (
  id uuid primary key default gen_random_uuid(),
  object_id uuid not null references public.objects (id) on delete cascade,
  template_id uuid not null references public.ppr_work_templates (id) on delete cascade,
  storage_path text not null,
  file_name text not null,
  mime_type text not null,
  size_bytes bigint not null,
  uploaded_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  constraint ppr_work_template_attachments_storage_path_key unique (storage_path)
);

create index if not exists idx_ppr_work_templates_object_id on public.ppr_work_templates (object_id);
create index if not exists idx_ppr_work_templates_subsystem_id on public.ppr_work_templates (subsystem_id);
create index if not exists idx_ppr_work_templates_is_active on public.ppr_work_templates (is_active);

create index if not exists idx_ppr_work_checklist_items_object_id on public.ppr_work_checklist_items (object_id);
create index if not exists idx_ppr_work_checklist_items_template_id on public.ppr_work_checklist_items (template_id);

create index if not exists idx_ppr_equipment_work_assignments_object_id on public.ppr_equipment_work_assignments (object_id);
create index if not exists idx_ppr_equipment_work_assignments_equipment_id on public.ppr_equipment_work_assignments (equipment_id);
create index if not exists idx_ppr_equipment_work_assignments_template_id on public.ppr_equipment_work_assignments (template_id);
create index if not exists idx_ppr_equipment_work_assignments_is_active on public.ppr_equipment_work_assignments (is_active);

create index if not exists idx_ppr_work_template_attachments_object_id on public.ppr_work_template_attachments (object_id);
create index if not exists idx_ppr_work_template_attachments_template_id on public.ppr_work_template_attachments (template_id);
create index if not exists idx_ppr_work_template_attachments_uploaded_by on public.ppr_work_template_attachments (uploaded_by);

create or replace function public.ppr_can_manage_templates(_object_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.ppr_can_manage_object_scope(_object_id)
$$;

create or replace function public.ppr_can_manage_assignments(_object_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.ppr_can_manage_object_scope(_object_id)
$$;

create or replace function public.ppr_validate_work_template_scope()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  subsystem_object_id uuid;
begin
  select ss.object_id
    into subsystem_object_id
  from public.ppr_subsystems ss
  where ss.id = new.subsystem_id;

  if subsystem_object_id is null then
    raise exception 'invalid ppr subsystem';
  end if;

  if subsystem_object_id <> new.object_id then
    raise exception 'ppr template subsystem must belong to template object';
  end if;

  return new;
end;
$$;

create or replace function public.ppr_validate_work_checklist_item_scope()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  template_object_id uuid;
begin
  select wt.object_id
    into template_object_id
  from public.ppr_work_templates wt
  where wt.id = new.template_id;

  if template_object_id is null then
    raise exception 'invalid ppr work template';
  end if;

  if template_object_id <> new.object_id then
    raise exception 'ppr checklist item must belong to template object';
  end if;

  return new;
end;
$$;

create or replace function public.ppr_validate_template_attachment_scope()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  template_object_id uuid;
begin
  select wt.object_id
    into template_object_id
  from public.ppr_work_templates wt
  where wt.id = new.template_id;

  if template_object_id is null then
    raise exception 'invalid ppr work template';
  end if;

  if template_object_id <> new.object_id then
    raise exception 'ppr template attachment must belong to template object';
  end if;

  return new;
end;
$$;

create or replace function public.ppr_validate_equipment_work_assignment_scope()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  equipment_object_id uuid;
  template_object_id uuid;
begin
  select e.object_id
    into equipment_object_id
  from public.ppr_equipment e
  where e.id = new.equipment_id;

  if equipment_object_id is null then
    raise exception 'invalid ppr equipment';
  end if;

  select wt.object_id
    into template_object_id
  from public.ppr_work_templates wt
  where wt.id = new.template_id;

  if template_object_id is null then
    raise exception 'invalid ppr work template';
  end if;

  if equipment_object_id <> new.object_id or template_object_id <> new.object_id then
    raise exception 'ppr assignment object mismatch';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_ppr_validate_work_template_scope on public.ppr_work_templates;
create trigger trg_ppr_validate_work_template_scope
before insert or update on public.ppr_work_templates
for each row execute function public.ppr_validate_work_template_scope();

drop trigger if exists trg_ppr_validate_work_checklist_item_scope on public.ppr_work_checklist_items;
create trigger trg_ppr_validate_work_checklist_item_scope
before insert or update on public.ppr_work_checklist_items
for each row execute function public.ppr_validate_work_checklist_item_scope();

drop trigger if exists trg_ppr_validate_template_attachment_scope on public.ppr_work_template_attachments;
create trigger trg_ppr_validate_template_attachment_scope
before insert or update on public.ppr_work_template_attachments
for each row execute function public.ppr_validate_template_attachment_scope();

drop trigger if exists trg_ppr_validate_equipment_work_assignment_scope on public.ppr_equipment_work_assignments;
create trigger trg_ppr_validate_equipment_work_assignment_scope
before insert or update on public.ppr_equipment_work_assignments
for each row execute function public.ppr_validate_equipment_work_assignment_scope();

alter table public.ppr_work_templates enable row level security;
alter table public.ppr_work_checklist_items enable row level security;
alter table public.ppr_work_template_attachments enable row level security;
alter table public.ppr_equipment_work_assignments enable row level security;

drop policy if exists "ppr_work_templates_select_by_object_access" on public.ppr_work_templates;
drop policy if exists "ppr_work_templates_manage_by_object_scope" on public.ppr_work_templates;

create policy "ppr_work_templates_select_by_object_access"
  on public.ppr_work_templates for select
  using (public.ppr_has_object_access(object_id));

create policy "ppr_work_templates_manage_by_object_scope"
  on public.ppr_work_templates for all
  using (public.ppr_can_manage_templates(object_id))
  with check (public.ppr_can_manage_templates(object_id));

drop policy if exists "ppr_work_checklist_items_select_by_object_access" on public.ppr_work_checklist_items;
drop policy if exists "ppr_work_checklist_items_manage_by_object_scope" on public.ppr_work_checklist_items;

create policy "ppr_work_checklist_items_select_by_object_access"
  on public.ppr_work_checklist_items for select
  using (public.ppr_has_object_access(object_id));

create policy "ppr_work_checklist_items_manage_by_object_scope"
  on public.ppr_work_checklist_items for all
  using (public.ppr_can_manage_templates(object_id))
  with check (public.ppr_can_manage_templates(object_id));

drop policy if exists "ppr_work_template_attachments_select_by_object_access" on public.ppr_work_template_attachments;
drop policy if exists "ppr_work_template_attachments_manage_by_object_scope" on public.ppr_work_template_attachments;

create policy "ppr_work_template_attachments_select_by_object_access"
  on public.ppr_work_template_attachments for select
  using (public.ppr_has_object_access(object_id));

create policy "ppr_work_template_attachments_manage_by_object_scope"
  on public.ppr_work_template_attachments for all
  using (public.ppr_can_manage_templates(object_id))
  with check (public.ppr_can_manage_templates(object_id));

drop policy if exists "ppr_equipment_work_assignments_select_by_object_access" on public.ppr_equipment_work_assignments;
drop policy if exists "ppr_equipment_work_assignments_manage_by_object_scope" on public.ppr_equipment_work_assignments;

create policy "ppr_equipment_work_assignments_select_by_object_access"
  on public.ppr_equipment_work_assignments for select
  using (public.ppr_has_object_access(object_id));

create policy "ppr_equipment_work_assignments_manage_by_object_scope"
  on public.ppr_equipment_work_assignments for all
  using (public.ppr_can_manage_assignments(object_id))
  with check (public.ppr_can_manage_assignments(object_id));
