alter table public.ppr_work_templates
  add column if not exists execution_mode text;

update public.ppr_work_templates
set execution_mode = 'in_house'
where execution_mode is null;

alter table public.ppr_work_templates
  alter column execution_mode set default 'in_house';

alter table public.ppr_work_templates
  alter column execution_mode set not null;

alter table public.ppr_work_templates
  drop constraint if exists ppr_work_templates_execution_mode_check;

alter table public.ppr_work_templates
  add constraint ppr_work_templates_execution_mode_check
  check (execution_mode in ('in_house', 'contractor'));
