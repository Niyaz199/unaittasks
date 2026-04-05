import { z } from "zod";
import { hasTaskTargetObjectAccess } from "@/lib/access/task-target-scope";
import { writeAudit } from "@/lib/audit";
import { sendPushToUser } from "@/lib/push";
import { canCreateOrAssignTask } from "@/lib/task-permissions";
import type { Profile, Role } from "@/lib/types";

export const taskCreateSchema = z.object({
  title: z.string().min(3),
  description: z.string().optional(),
  objectId: z.string().uuid(),
  priority: z.enum(["low", "medium", "high", "critical"]),
  dueAt: z.string().optional(),
  assignedTo: z.string().uuid(),
  teamMemberIds: z.array(z.string().uuid()).optional(),
});

export type TaskCreatePayload = z.infer<typeof taskCreateSchema>;

type SupabaseLike = Awaited<ReturnType<typeof import("@/lib/supabase/server").createSupabaseServerClient>>;

export function parseTaskCreateFormData(formData: FormData) {
  return taskCreateSchema.parse({
    title: String(formData.get("title") ?? ""),
    description: String(formData.get("description") ?? ""),
    objectId: String(formData.get("object_id") ?? ""),
    priority: String(formData.get("priority") ?? "medium"),
    dueAt: String(formData.get("due_at") ?? ""),
    assignedTo: String(formData.get("assigned_to") ?? ""),
    teamMemberIds: formData.getAll("team_member_ids").map(String).filter(Boolean),
  });
}

export function normalizeTaskDueAt(value?: string | null) {
  if (!value?.trim()) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error("Некорректный срок due_at");
  return date.toISOString();
}

async function getRoleByUserId(supabase: SupabaseLike, userId: string) {
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", userId).single();
  return profile?.role as Role | undefined;
}

async function getRolesByUserIds(supabase: SupabaseLike, userIds: string[]) {
  const uniqueIds = [...new Set(userIds)];
  if (!uniqueIds.length) {
    return new Map<string, Role>();
  }
  const { data, error } = await supabase.from("profiles").select("id,role").in("id", uniqueIds);
  if (error) throw error;
  return new Map((data ?? []).map((row) => [row.id as string, row.role as Role]));
}

async function getObjectEngineerByObjectId(supabase: SupabaseLike, objectId: string) {
  const { data: objectRow } = await supabase.from("objects").select("object_engineer_id").eq("id", objectId).single();
  return objectRow?.object_engineer_id ?? null;
}

async function isObjectAccessibleForUser(
  _supabase: SupabaseLike,
  profile: Pick<{ id: string; role: Role }, "id" | "role">,
  objectId: string
) {
  return hasTaskTargetObjectAccess(profile, objectId);
}

async function assertTaskObjectAccessForUser(
  supabase: SupabaseLike,
  profile: Pick<{ id: string; role: Role }, "id" | "role">,
  objectId: string,
  errorMessage: string
) {
  const accessible = await isObjectAccessibleForUser(supabase, profile, objectId);
  if (!accessible) {
    throw new Error(errorMessage);
  }
}

export async function createTaskFromPayload(input: {
  supabase: SupabaseLike;
  actor: Pick<Profile, "id" | "role">;
  payload: TaskCreatePayload;
  extraAuditMeta?: Record<string, unknown>;
}) {
  const { supabase, actor, payload, extraAuditMeta } = input;
  const dueAtIso = normalizeTaskDueAt(payload.dueAt);

  const assigneeRole = await getRoleByUserId(supabase, payload.assignedTo);
  if (!assigneeRole) throw new Error("Не найден профиль назначаемого пользователя");

  if (actor.role === "engineer" || actor.role === "object_engineer") {
    await assertTaskObjectAccessForUser(
      supabase,
      actor,
      payload.objectId,
      "Объект недоступен для создания задачи"
    );
  }

  const objectEngineerId = await getObjectEngineerByObjectId(supabase, payload.objectId);
  const objectEngineerScoped = objectEngineerId === actor.id;
  const canAssign = canCreateOrAssignTask(actor.role, assigneeRole, { objectEngineerScoped });
  if (!canAssign) {
    throw new Error("Недостаточно прав для назначения выбранного исполнителя");
  }

  await assertTaskObjectAccessForUser(
    supabase,
    { id: payload.assignedTo, role: assigneeRole },
    payload.objectId,
    "Выбранный исполнитель не имеет доступа к объекту задачи"
  );

  const dedupTeamMemberIds = [...new Set((payload.teamMemberIds ?? []).filter((id) => id !== payload.assignedTo))];
  const teamRoleMap = await getRolesByUserIds(supabase, dedupTeamMemberIds);
  for (const memberId of dedupTeamMemberIds) {
    const memberRole = teamRoleMap.get(memberId);
    if (!memberRole) throw new Error("Не найден профиль участника команды");
    if (!canCreateOrAssignTask(actor.role, memberRole, { objectEngineerScoped })) {
      throw new Error("Недостаточно прав для добавления выбранного участника команды");
    }
    await assertTaskObjectAccessForUser(
      supabase,
      { id: memberId, role: memberRole },
      payload.objectId,
      "Выбранный участник команды не имеет доступа к объекту задачи"
    );
  }

  const { data, error } = await supabase
    .from("tasks")
    .insert({
      title: payload.title.trim(),
      description: payload.description?.trim() || null,
      object_id: payload.objectId,
      status: "new",
      priority: payload.priority,
      due_at: dueAtIso,
      created_by: actor.id,
      assigned_to: payload.assignedTo,
    })
    .select("id,title")
    .single();
  if (error) throw error;

  if (dedupTeamMemberIds.length) {
    const rows = dedupTeamMemberIds.map((memberId) => ({
      task_id: data.id,
      user_id: memberId,
      added_by: actor.id,
    }));
    const { error: teamError } = await supabase.from("task_team_members").upsert(rows);
    if (teamError) throw teamError;
  }

  await writeAudit({
    actorId: actor.id,
    action: "create_task",
    entityType: "task",
    entityId: data.id,
    meta: {
      assigned_to: payload.assignedTo,
      team_member_ids: dedupTeamMemberIds,
      priority: payload.priority,
      due_at: dueAtIso,
      ...(extraAuditMeta ?? {}),
    },
    supabase,
  });

  if (payload.assignedTo !== actor.id) {
    await writeAudit({
      actorId: actor.id,
      action: "assign_task",
      entityType: "task",
      entityId: data.id,
      meta: {
        assigned_to: payload.assignedTo,
        ...(extraAuditMeta ?? {}),
      },
      supabase,
    });
  }

  await sendPushToUser(payload.assignedTo, {
    title: "Новая задача",
    body: payload.title,
    taskId: data.id,
    url: `/tasks/${data.id}`,
  });

  return {
    taskId: data.id,
    title: data.title,
    dueAtIso,
  };
}
