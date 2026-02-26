import { createSupabaseServerClient } from "@/lib/supabase/server";

type AuditAction =
  | "create_task"
  | "update_task"
  | "assign_task"
  | "assign"
  | "accept"
  | "status_change"
  | "pause_task"
  | "comment"
  | "team_add_member"
  | "team_remove_member"
  | "create_object"
  | "update_object"
  | "delete_object"
  | "create_user"
  | "update_user"
  | "delete_user";

export async function writeAudit(input: {
  actorId: string;
  action: AuditAction;
  entityType: "task" | "object" | "user" | "comment";
  entityId: string;
  meta?: Record<string, unknown>;
}) {
  const supabase = await createSupabaseServerClient();
  await supabase.from("audit_log").insert({
    actor_id: input.actorId,
    action: input.action,
    entity_type: input.entityType,
    entity_id: input.entityId,
    meta: input.meta ?? {}
  });
}
