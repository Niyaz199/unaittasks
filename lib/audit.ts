import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type AuditAction =
  | "create_task"
  | "update_task"
  | "assign_task"
  | "assign"
  | "accept"
  | "status_change"
  | "pause_task"
  | "task_archived_manual"
  | "comment"
  | "team_add_member"
  | "team_remove_member"
  | "create_object"
  | "update_object"
  | "delete_object"
  | "create_user"
  | "update_user"
  | "delete_user"
  | "create_ppr_system_group"
  | "update_ppr_system_group"
  | "create_ppr_system"
  | "update_ppr_system"
  | "create_ppr_subsystem"
  | "update_ppr_subsystem"
  | "create_ppr_room"
  | "update_ppr_room"
  | "create_object_room"
  | "update_object_room"
  | "create_floor"
  | "update_floor"
  | "delete_floor"
  | "create_room_type"
  | "update_room_type"
  | "delete_room_type"
  | "create_ppr_equipment"
  | "update_ppr_equipment"
  | "create_ppr_template"
  | "update_ppr_template"
  | "create_ppr_assignment"
  | "update_ppr_assignment"
  | "generate_ppr_month_plan"
  | "reschedule_ppr_month_plan_item"
  | "assign_ppr_task"
  | "start_ppr_task"
  | "complete_ppr_task"
  | "close_ppr_task"
  | "cancel_ppr_task"
  | "reschedule_ppr_task"
  | "system_cron_run_started"
  | "system_carryover_completed"
  | "system_materialization_completed"
  | "system_plan_item_sync_completed"
  | "system_cron_run_finished";

export async function writeAudit(input: {
  actorId: string | null;
  action: AuditAction;
  entityType:
    | "task"
    | "object"
    | "user"
    | "comment"
    | "ppr_system_group"
    | "ppr_system"
    | "ppr_subsystem"
    | "ppr_room"
    | "object_room"
    | "floor"
    | "room_type"
    | "ppr_equipment"
    | "ppr_template"
    | "ppr_assignment"
    | "ppr_month_plan"
    | "ppr_month_plan_item"
    | "ppr_task"
    | "ppr_cron_run";
  entityId: string;
  meta?: Record<string, unknown>;
  supabase?: SupabaseClient;
}) {
  const supabase = input.supabase ?? (await createSupabaseServerClient());
  const { error } = await supabase.from("audit_log").insert({
    actor_id: input.actorId,
    action: input.action,
    entity_type: input.entityType,
    entity_id: input.entityId,
    meta: input.meta ?? {}
  });
  if (error) throw error;
}
