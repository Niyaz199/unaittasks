drop index if exists idx_ppr_equipment_subsystem_id;
drop index if exists idx_ppr_subsystems_object_id;
drop index if exists idx_ppr_subsystems_system_id;
drop index if exists idx_ppr_subsystems_parent_id;
drop index if exists idx_ppr_rooms_object_id;
drop index if exists idx_ppr_work_templates_subsystem_id;
drop index if exists ppr_subsystems_root_name_uidx;
drop index if exists ppr_subsystems_parent_name_uidx;

alter table public.ppr_equipment
  drop column if exists subsystem_id;

alter table public.ppr_work_templates
  drop column if exists subsystem_id;

alter table public.ppr_month_plan_items
  drop column if exists subsystem_id;

alter table public.ppr_tasks
  drop column if exists subsystem_id;

drop table if exists public.ppr_subsystems;
drop table if exists public.ppr_rooms;
