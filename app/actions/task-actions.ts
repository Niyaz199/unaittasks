"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { canEditTasks, canManageObjects, canManageTaskTeam, requireProfile } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { writeAudit } from "@/lib/audit";
import { sendPushToUser } from "@/lib/push";
import {
  canChangeStatus,
  canCreateOrAssignTask,
  canManageTaskTeam as canManageTaskTeamByRole,
  canReadTaskByRole
} from "@/lib/task-permissions";
import type { Role, TaskStatus } from "@/lib/types";

const statusSchema = z.enum(["new", "in_progress", "paused", "done"]);
const pauseSchema = z.object({
  taskId: z.string().uuid(),
  reason: z.string().trim().min(5),
  resumeAt: z.string().datetime()
});
const taskCreateSchema = z.object({
  title: z.string().min(3),
  description: z.string().optional(),
  objectId: z.string().uuid(),
  priority: z.enum(["low", "medium", "high", "critical"]),
  dueAt: z.string().optional(),
  assignedTo: z.string().uuid(),
  teamMemberIds: z.array(z.string().uuid()).optional()
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

async function getObjectEngineerByObjectId(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  objectId: string
) {
  const { data: objectRow } = await supabase.from("objects").select("object_engineer_id").eq("id", objectId).single();
  return objectRow?.object_engineer_id ?? null;
}

export async function takeTaskInWork(taskId: string) {
  const { profile } = await requireProfile();
  const supabase = await createSupabaseServerClient();

  const task = await getTaskAccessRow(supabase, taskId);

  if (!task) throw new Error("Задача не найдена");

  const canChange = canChangeStatus(task, { id: profile.id, role: profile.role }, { teamMemberIds: getTeamMemberIds(task) });
  if (!canChange) throw new Error("Нет прав на изменение статуса");

  const patch: Record<string, unknown> = { status: "in_progress" };
  if (!task.accepted_at) patch.accepted_at = new Date().toISOString();

  const { error } = await supabase.from("tasks").update(patch).eq("id", taskId);
  if (error) throw error;

  await writeAudit({
    actorId: profile.id,
    action: "accept",
    entityType: "task",
    entityId: taskId,
    meta: { from: task.status, to: "in_progress" }
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

  const patch: Record<string, unknown> = { status };
  if (status === "in_progress" && !task.accepted_at) patch.accepted_at = new Date().toISOString();
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

  const canRead = canReadTaskByRole(
    profile.role,
    profile.id,
    task,
    getTeamMemberIds(task),
    getObjectEngineerId(task)
  );
  if (!canRead) {
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

  const payload = taskCreateSchema.parse({
    title: String(formData.get("title") ?? ""),
    description: String(formData.get("description") ?? ""),
    objectId: String(formData.get("object_id") ?? ""),
    priority: String(formData.get("priority") ?? "medium"),
    dueAt: String(formData.get("due_at") ?? ""),
    assignedTo: String(formData.get("assigned_to") ?? ""),
    teamMemberIds: formData.getAll("team_member_ids").map(String).filter(Boolean)
  });
  const dueAtIso = payload.dueAt?.trim()
    ? (() => {
        const date = new Date(payload.dueAt);
        if (Number.isNaN(date.getTime())) throw new Error("Некорректный срок due_at");
        return date.toISOString();
      })()
    : null;

  const supabase = await createSupabaseServerClient();
  const assigneeRole = await getRoleByUserId(supabase, payload.assignedTo);
  if (!assigneeRole) throw new Error("Не найден профиль назначаемого пользователя");

  const objectEngineerId = await getObjectEngineerByObjectId(supabase, payload.objectId);
  const canAssign = canCreateOrAssignTask(profile.role, assigneeRole, {
    objectEngineerScoped: objectEngineerId === profile.id
  });
  if (!canAssign) {
    throw new Error("Недостаточно прав для назначения выбранного исполнителя");
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
      created_by: profile.id,
      assigned_to: payload.assignedTo
    })
    .select("id,title")
    .single();
  if (error) throw error;

  const dedupTeamMemberIds = [...new Set((payload.teamMemberIds ?? []).filter((id) => id !== payload.assignedTo))];
  if (dedupTeamMemberIds.length) {
    const rows = dedupTeamMemberIds.map((memberId) => ({
      task_id: data.id,
      user_id: memberId,
      added_by: profile.id
    }));
    const { error: teamError } = await supabase.from("task_team_members").upsert(rows);
    if (teamError) throw teamError;
  }

  await writeAudit({
    actorId: profile.id,
    action: "create_task",
    entityType: "task",
    entityId: data.id,
    meta: {
      assigned_to: payload.assignedTo,
      team_member_ids: dedupTeamMemberIds,
      priority: payload.priority,
      due_at: dueAtIso
    }
  });

  if (payload.assignedTo !== profile.id) {
    await writeAudit({
      actorId: profile.id,
      action: "assign_task",
      entityType: "task",
      entityId: data.id,
      meta: { assigned_to: payload.assignedTo }
    });
  }

  await sendPushToUser(payload.assignedTo, {
    title: "Новая задача",
    body: payload.title,
    taskId: data.id,
    url: `/tasks/${data.id}`
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

    const payload = taskCreateSchema.parse({
      title: String(formData.get("title") ?? ""),
      description: String(formData.get("description") ?? ""),
      objectId: String(formData.get("object_id") ?? ""),
      priority: String(formData.get("priority") ?? "medium"),
      dueAt: String(formData.get("due_at") ?? ""),
      assignedTo: String(formData.get("assigned_to") ?? ""),
      teamMemberIds: formData.getAll("team_member_ids").map(String).filter(Boolean)
    });

    const dueAtIso = payload.dueAt?.trim()
      ? (() => {
          const date = new Date(payload.dueAt);
          if (Number.isNaN(date.getTime())) throw new Error("Некорректный срок due_at");
          return date.toISOString();
        })()
      : null;

    const supabase = await createSupabaseServerClient();
    const assigneeRole = await getRoleByUserId(supabase, payload.assignedTo);
    if (!assigneeRole) return { ok: false, error: "Не найден профиль исполнителя" };

    const objectEngineerId = await getObjectEngineerByObjectId(supabase, payload.objectId);
    const canAssign = canCreateOrAssignTask(profile.role, assigneeRole, {
      objectEngineerScoped: objectEngineerId === profile.id
    });
    if (!canAssign) return { ok: false, error: "Недостаточно прав для назначения выбранного исполнителя" };

    const { data, error } = await supabase
      .from("tasks")
      .insert({
        title: payload.title.trim(),
        description: payload.description?.trim() || null,
        object_id: payload.objectId,
        status: "new",
        priority: payload.priority,
        due_at: dueAtIso,
        created_by: profile.id,
        assigned_to: payload.assignedTo
      })
      .select("id,title")
      .single();
    if (error) return { ok: false, error: "Ошибка при создании задачи" };

    const dedupTeamMemberIds = [...new Set((payload.teamMemberIds ?? []).filter((id) => id !== payload.assignedTo))];
    if (dedupTeamMemberIds.length) {
      const rows = dedupTeamMemberIds.map((memberId) => ({
        task_id: data.id,
        user_id: memberId,
        added_by: profile.id
      }));
      const { error: teamError } = await supabase.from("task_team_members").upsert(rows);
      if (teamError) return { ok: false, error: "Задача создана, но не удалось добавить участников команды" };
    }

    await writeAudit({
      actorId: profile.id,
      action: "create_task",
      entityType: "task",
      entityId: data.id,
      meta: { assigned_to: payload.assignedTo, team_member_ids: dedupTeamMemberIds, priority: payload.priority, due_at: dueAtIso }
    });

    if (payload.assignedTo !== profile.id) {
      await writeAudit({
        actorId: profile.id,
        action: "assign_task",
        entityType: "task",
        entityId: data.id,
        meta: { assigned_to: payload.assignedTo }
      });
    }

    await sendPushToUser(payload.assignedTo, {
      title: "Новая задача",
      body: payload.title,
      taskId: data.id,
      url: `/tasks/${data.id}`
    });

    revalidatePath("/my");
    revalidatePath("/new");

    return { ok: true, taskId: data.id };
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

  const canManage = canManageTaskTeamByRole(profile.role, {
    objectEngineerScoped: getObjectEngineerId(task) === profile.id
  });
  if (!canManage) throw new Error("Нет прав на изменение команды");

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
