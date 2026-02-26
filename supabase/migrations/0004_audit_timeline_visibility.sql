-- Allow lead/engineer to read task history timeline events

drop policy if exists "audit_log_select_admin_chief" on public.audit_log;
drop policy if exists "audit_log_select_timeline_access" on public.audit_log;

create policy "audit_log_select_timeline_access"
  on public.audit_log for select
  using (
    public.is_superuser()
    or public.current_role() = 'chief'
    or (
      public.current_role() in ('lead', 'engineer')
      and entity_type = 'task'
      and exists (
        select 1
        from public.tasks t
        where t.id = audit_log.entity_id
          and public.can_read_task(t)
      )
    )
  );
