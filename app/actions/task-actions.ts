"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { canEditTasks, canManageObjects, canManageTaskTeam, requireProfile } from "@/lib/auth";
import { hasTaskTargetObjectAccess } from "@/lib/access/task-target-scope";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { writeAudit } from "@/lib/audit";
import { createTaskFromPayload, parseTaskCreateFormData } from "@/lib/task-create";
import {
  canAddTaskTeamMember,
  canChangeStatus,
  canCreateOrAssignTask,
  canTransitionTaskStatus,
  canManageTaskTeam as canManageTaskTeamByRole,
  canWorkOnTaskByRole
} from "@/lib/task-permissions";
import type { Role, TaskStatus } from "@/lib/types";

const statusSchema = z.enum(["new", "accepted", "in_progress", "paused", "done"]);
const pauseSchema = z.object({
  taskId: z.string().uuid(),
  reason: z.string().trim().min(5),
  resumeAt: z.string().datetime()
});
const objectUpdateSchema = z.object({
  objectId: z.string().uuid(),
  name: z.string().min(2),
  objectEngineerId: z.string().uuid().nullable().optional()
});
const objectDeleteSchema = z.object({
  objectId: z.string().uuid()
});
const teamMemberSchema = z.object({
  taskId: z.string().uuid(),
  userId: z.string().uuid()
});

type TaskAccessRow = {
  id: string;
  status: TaskStatus;
  assigned_to: string;
  accepted_at: string | null;
  completed_at: string | null;
  created_by: string;
  object_id: string;
  team_members: Array<{ user_id: string }> | null;
  objects: { object_engineer_id: string | null } | Array<{ object_engineer_id: string | null }> | null;
};

function getTeamMemberIds(task: TaskAccessRow) {
  return (task.team_members ?? []).map((member) => member.user_id);
}

function getObjectEngineerId(task: TaskAccessRow) {
  if (Array.isArray(task.objects)) return task.objects[0]?.object_engineer_id ?? null;
  return task.objects?.object_engineer_id ?? null;
}

async function getTaskAccessRow(supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>, taskId: string) {
  const { data: task } = await supabase
    .from("tasks")
    .select(
      "id,status,assigned_to,accepted_at,completed_at,created_by,object_id,team_members:task_team_members(user_id),objects(object_engineer_id)"
    )
    .eq("id", taskId)
    .single();
  return task as TaskAccessRow | null;
}

async function getRoleByUserId(supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>, userId: string) {
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", userId).single();
  return profile?.role as Role | undefined;
}

async function isObjectAccessibleForUser(
  _supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  profile: Pick<{ id: string; role: Role }, "id" | "role">,
  objectId: string
): Promise<boolean> {
  return hasTaskTargetObjectAccess(profile, objectId);
}

async function assertTaskObjectAccessForUser(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  profile: Pick<{ id: string; role: Role }, "id" | "role">,
  objectId: string,
  errorMessage: string
) {
  const accessible = await isObjectAccessibleForUser(supabase, profile, objectId);
  if (!accessible) {
    throw new Error(errorMessage);
  }
}

export async function takeTaskInWork(taskId: string) {
  const { profile } = await requireProfile();
  const supabase = await createSupabaseServerClient();

  const task = await getTaskAccessRow(supabase, taskId);

  if (!task) throw new Error("Задача не найдена");

  const canChange = canChangeStatus(task, { id: profile.id, role: profile.role }, { teamMemberIds: getTeamMemberIds(task) });
  if (!canChange) throw new Error("Нет прав на изменение статуса");

  if (!canTransitionTaskStatus(task.status, "accepted")) {
    throw new Error("Недопустимый переход статуса");
  }

  const patch: Record<string, unknown> = { status: "accepted" };
  if (!task.accepted_at) patch.accepted_at = new Date().toISOString();

  const { error } = await supabase.from("tasks").update(patch).eq("id", taskId);
  if (error) throw error;

  await writeAudit({
    actorId: profile.id,
    action: "accept",
    entityType: "task",
    entityId: taskId,
    meta: { from: task.status, to: "accepted" }
  });

  revalidatePath("/new");
  revalidatePath("/my");
  revalidatePath(`/tasks/${taskId}`);
}

export async function updateTaskStatus(taskId: string, statusInput: string) {
  const status = statusSchema.parse(statusInput) as TaskStatus;
  if (status === "paused") {
    throw new Error("Для постановки на паузу используйте отдельное действие с причиной и датой восстановления");
  }
  const { profile } = await requireProfile();
  const supabase = await createSupabaseServerClient();

  const task = await getTaskAccessRow(supabase, taskId);
  if (!task) throw new Error("Задача не найдена");

  const canChange = canChangeStatus(task, { id: profile.id, role: profile.role }, { teamMemberIds: getTeamMemberIds(task) });
  if (!canChange) throw new Error("Статус может менять только ответственный или участник команды");
  if (!canTransitionTaskStatus(task.status, status)) throw new Error("Недопустимый переход статуса");

  const patch: Record<string, unknown> = { status };
  if ((status === "accepted" || status === "in_progress") && !task.accepted_at) patch.accepted_at = new Date().toISOString();
  if (status === "done" && !task.completed_at) patch.completed_at = new Date().toISOString();
  patch.resume_at = null;

  const { error } = await supabase.from("tasks").update(patch).eq("id", taskId);
  if (error) throw error;

  await writeAudit({
    actorId: profile.id,
    action: "status_change",
    entityType: "task",
    entityId: taskId,
    meta: { from: task.status, to: status }
  });

  revalidatePath("/my");
  revalidatePath("/new");
  revalidatePath("/archive");
  revalidatePath(`/tasks/${taskId}`);
}

export async function pauseTask(taskId: string, input: { reason: string; resumeAt: string }) {
  const payload = pauseSchema.parse({ taskId, reason: input.reason, resumeAt: input.resumeAt });
  const resumeAtDate = new Date(payload.resumeAt);
  if (Number.isNaN(resumeAtDate.getTime()) || resumeAtDate.getTime() <= Date.now()) {
    throw new Error("Дата возобновления должна быть в будущем");
  }

  const { profile } = await requireProfile();
  const supabase = await createSupabaseServerClient();
  const task = await getTaskAccessRow(supabase, payload.taskId);
  if (!task) throw new Error("Задача не найдена");

  const canPause = canChangeStatus(task, { id: profile.id, role: profile.role }, { teamMemberIds: getTeamMemberIds(task) });
  if (!canPause) throw new Error("Нет прав на постановку задачи на паузу");

  const { error } = await supabase.rpc("pause_task", {
    p_task_id: payload.taskId,
    p_reason: payload.reason,
    p_resume_at: resumeAtDate.toISOString()
  });
  if (error) throw error;

  revalidatePath("/my");
  revalidatePath("/new");
  revalidatePath("/archive");
  revalidatePath(`/tasks/${payload.taskId}`);
}

export async function addTaskComment(taskId: string, body: string, clientMsgId?: string) {
  const bodyTrimmed = body.trim();
  if (!bodyTrimmed) throw new Error("Пустой комментарий");

  const { profile } = await requireProfile();
  const supabase = await createSupabaseServerClient();

  const task = await getTaskAccessRow(supabase, taskId);
  if (!task) throw new Error("Задача не найдена");

  const canWork = canWorkOnTaskByRole(
    profile.role,
    profile.id,
    task,
    getTeamMemberIds(task),
    getObjectEngineerId(task)
  );
  if (!canWork) {
    throw new Error("Нет доступа к задаче");
  }

  const payload = {
    task_id: taskId,
    author_id: profile.id,
    body: bodyTrimmed,
    client_msg_id: clientMsgId ?? null
  };

  const { data, error } = await supabase.from("task_comments").insert(payload).select("id").single();
  if (error) throw error;

  await writeAudit({
    actorId: profile.id,
    action: "comment",
    entityType: "comment",
    entityId: data.id,
    meta: { task_id: taskId }
  });

  revalidatePath(`/tasks/${taskId}`);
}

export async function createObjectAction(nameInput: string, objectEngineerIdInput?: string | null) {
  const name = nameInput.trim();
  if (!name) throw new Error("Название объекта обязательно");

  const { profile } = await requireProfile();
  if (!canManageObjects(profile.role)) throw new Error("Нет прав на создание объектов");

  const objectEngineerId = objectEngineerIdInput?.trim() ? objectEngineerIdInput : null;
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("objects")
    .insert({ name, created_by: profile.id, object_engineer_id: objectEngineerId })
    .select("id")
    .single();
  if (error) throw error;

  await writeAudit({
    actorId: profile.id,
    action: "create_object",
    entityType: "object",
    entityId: data.id,
    meta: { name, object_engineer_id: objectEngineerId }
  });

  revalidatePath("/objects");
}

export async function createObjectFormAction(formData: FormData) {
  const name = String(formData.get("name") ?? "");
  const objectEngineerId = String(formData.get("object_engineer_id") ?? "");
  await createObjectAction(name, objectEngineerId || null);
}

export async function updateObjectAction(formData: FormData) {
  const { profile } = await requireProfile();
  if (!canManageObjects(profile.role)) throw new Error("Нет прав на изменение объектов");

  const payload = objectUpdateSchema.parse({
    objectId: String(formData.get("object_id") ?? ""),
    name: String(formData.get("name") ?? "").trim(),
    objectEngineerId: String(formData.get("object_engineer_id") ?? "") || null
  });

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("objects")
    .update({ name: payload.name, object_engineer_id: payload.objectEngineerId ?? null })
    .eq("id", payload.objectId);
  if (error) throw error;

  await writeAudit({
    actorId: profile.id,
    action: "update_object",
    entityType: "object",
    entityId: payload.objectId,
    meta: { name: payload.name, object_engineer_id: payload.objectEngineerId ?? null }
  });

  revalidatePath("/objects");
}

export async function deleteObjectAction(formData: FormData) {
  const { profile } = await requireProfile();
  if (!canManageObjects(profile.role)) throw new Error("Нет прав на удаление объектов");

  const payload = objectDeleteSchema.parse({
    objectId: String(formData.get("object_id") ?? "")
  });

  const supabase = await createSupabaseServerClient();
  const { count, error: tasksCountError } = await supabase
    .from("tasks")
    .select("id", { count: "exact", head: true })
    .eq("object_id", payload.objectId);
  if (tasksCountError) throw tasksCountError;
  if ((count ?? 0) > 0) {
    throw new Error("Нельзя удалить объект: есть связанные задачи");
  }

  const { error } = await supabase.from("objects").delete().eq("id", payload.objectId);
  if (error) throw error;

  await writeAudit({
    actorId: profile.id,
    action: "delete_object",
    entityType: "object",
    entityId: payload.objectId,
    meta: {}
  });

  revalidatePath("/objects");
}

export async function createTaskAction(formData: FormData) {
  const { profile } = await requireProfile();
  if (!canEditTasks(profile.role)) throw new Error("Нет прав на создание задач");
  const payload = parseTaskCreateFormData(formData);
  const supabase = await createSupabaseServerClient();
  await createTaskFromPayload({
    supabase,
    actor: profile,
    payload,
  });

  revalidatePath("/my");
  revalidatePath("/new");
}

export async function createTaskActionSafe(
  formData: FormData
): Promise<{ ok: true; taskId: string } | { ok: false; error: string }> {
  try {
    const { profile } = await requireProfile();
    if (!canEditTasks(profile.role)) return { ok: false, error: "Нет прав на создание задач" };
    const payload = parseTaskCreateFormData(formData);
    const supabase = await createSupabaseServerClient();
    const result = await createTaskFromPayload({
      supabase,
      actor: profile,
      payload,
    });

    revalidatePath("/my");
    revalidatePath("/new");

    return { ok: true, taskId: result.taskId };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Неизвестная ошибка";
    return { ok: false, error: message };
  }
}

export async function addTaskTeamMemberAction(formData: FormData) {
  const { profile } = await requireProfile();
  if (!canManageTaskTeam(profile.role)) {
    throw new Error("Нет прав на изменение команды");
  }

  const payload = teamMemberSchema.parse({
    taskId: String(formData.get("task_id") ?? ""),
    userId: String(formData.get("user_id") ?? "")
  });

  const supabase = await createSupabaseServerClient();
  const task = await getTaskAccessRow(supabase, payload.taskId);
  if (!task) throw new Error("Задача не найдена");

  const objectEngineerScoped = getObjectEngineerId(task) === profile.id;
  const canManage = canManageTaskTeamByRole(profile.role, { objectEngineerScoped });
  if (!canManage) throw new Error("\u041d\u0435\u0442 \u043f\u0440\u0430\u0432 \u043d\u0430 \u0438\u0437\u043c\u0435\u043d\u0435\u043d\u0438\u0435 \u043a\u043e\u043c\u0430\u043d\u0434\u044b");

  const memberRole = await getRoleByUserId(supabase, payload.userId);
  if (!memberRole) throw new Error("\u041d\u0435 \u043d\u0430\u0439\u0434\u0435\u043d \u043f\u0440\u043e\u0444\u0438\u043b\u044c \u0443\u0447\u0430\u0441\u0442\u043d\u0438\u043a\u0430 \u043a\u043e\u043c\u0430\u043d\u0434\u044b");
  const isSelfAdd = payload.userId === profile.id;
  const isAssigneeAdd = payload.userId === task.assigned_to;
  if (!canAddTaskTeamMember(profile.role, memberRole, { objectEngineerScoped, isSelfAdd, isAssigneeAdd })) {
    throw new Error("\u041d\u0435\u0434\u043e\u0441\u0442\u0430\u0442\u043e\u0447\u043d\u043e \u043f\u0440\u0430\u0432 \u0434\u043b\u044f \u0434\u043e\u0431\u0430\u0432\u043b\u0435\u043d\u0438\u044f \u0432\u044b\u0431\u0440\u0430\u043d\u043d\u043e\u0433\u043e \u0443\u0447\u0430\u0441\u0442\u043d\u0438\u043a\u0430 \u043a\u043e\u043c\u0430\u043d\u0434\u044b");
  }
  await assertTaskObjectAccessForUser(
    supabase,
    { id: payload.userId, role: memberRole },
    task.object_id,
    "\u0412\u044b\u0431\u0440\u0430\u043d\u043d\u044b\u0439 \u0443\u0447\u0430\u0441\u0442\u043d\u0438\u043a \u043a\u043e\u043c\u0430\u043d\u0434\u044b \u043d\u0435 \u0438\u043c\u0435\u0435\u0442 \u0434\u043e\u0441\u0442\u0443\u043f\u0430 \u043a \u043e\u0431\u044a\u0435\u043a\u0442\u0443 \u0437\u0430\u0434\u0430\u0447\u0438"
  );

  const { error } = await supabase.from("task_team_members").upsert({
    task_id: payload.taskId,
    user_id: payload.userId,
    added_by: profile.id
  });
  if (error) throw error;

  await writeAudit({
    actorId: profile.id,
    action: "team_add_member",
    entityType: "task",
    entityId: payload.taskId,
    meta: { user_id: payload.userId }
  });

  revalidatePath("/my");
  revalidatePath(`/tasks/${payload.taskId}`);
}

export async function removeTaskTeamMemberAction(formData: FormData) {
  const { profile } = await requireProfile();
  if (!canManageTaskTeam(profile.role)) {
    throw new Error("Нет прав на изменение команды");
  }

  const payload = teamMemberSchema.parse({
    taskId: String(formData.get("task_id") ?? ""),
    userId: String(formData.get("user_id") ?? "")
  });

  const supabase = await createSupabaseServerClient();
  const task = await getTaskAccessRow(supabase, payload.taskId);
  if (!task) throw new Error("Задача не найдена");

  const canManage = canManageTaskTeamByRole(profile.role, {
    objectEngineerScoped: getObjectEngineerId(task) === profile.id
  });
  if (!canManage) throw new Error("Нет прав на изменение команды");

  const { error } = await supabase
    .from("task_team_members")
    .delete()
    .eq("task_id", payload.taskId)
    .eq("user_id", payload.userId);
  if (error) throw error;

  await writeAudit({
    actorId: profile.id,
    action: "team_remove_member",
    entityType: "task",
    entityId: payload.taskId,
    meta: { user_id: payload.userId }
  });

  revalidatePath("/my");
  revalidatePath(`/tasks/${payload.taskId}`);
}
