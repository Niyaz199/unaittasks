"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Route } from "next";
import { z } from "zod";
import { requireProfile } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { assertManageableUserPayload, canManageUserRole, canManageUsers as canManageUsersByRole } from "@/lib/access/users";
import { writeAudit } from "@/lib/audit";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  fullName: z.string().min(2),
  role: z.enum(["admin", "chief", "lead", "engineer", "object_engineer", "tech"]),
  objectIds: z.array(z.string().uuid()).optional()
});

const updateSchema = z.object({
  userId: z.string().uuid(),
  fullName: z.string().min(2),
  role: z.enum(["admin", "chief", "lead", "engineer", "object_engineer", "tech"]),
  objectIds: z.array(z.string().uuid()).optional()
});

const deleteSchema = z.object({
  userId: z.string().uuid()
});

function buildCreateUserErrorRedirect(message: string): Route {
  return `/users/create?error=${encodeURIComponent(message)}` as Route;
}

export async function createUserAction(formData: FormData) {
  const actor = await requireProfile();
  const sessionSupabase = actor.supabase;
  if (!canManageUsersByRole(actor.profile.role)) {
    throw new Error("Нет прав на создание пользователей");
  }

  const payload = schema.parse({
    email: String(formData.get("email") ?? ""),
    password: String(formData.get("password") ?? ""),
    fullName: String(formData.get("full_name") ?? ""),
    role: String(formData.get("role") ?? ""),
    objectIds: formData.getAll("object_ids").map(String).filter(Boolean)
  });

  const admin = createSupabaseAdminClient();
  const manageableObjectIds = await assertManageableUserPayload(sessionSupabase, actor.profile, payload.role, payload.objectIds ?? []);
  const { data: created, error: authError } = await admin.auth.admin.createUser({
    email: payload.email,
    password: payload.password,
    email_confirm: true
  });
  if (authError || !created.user) {
    const rawMessage = authError?.message ?? "Ошибка создания пользователя";
    const duplicateEmail =
      /already.*registered/i.test(rawMessage) || /already exists/i.test(rawMessage) || /уже зарегистрирован/i.test(rawMessage);

    if (duplicateEmail) {
      redirect(buildCreateUserErrorRedirect("Пользователь с таким email уже существует. Откройте список пользователей и отредактируйте его."));
    }

    redirect(buildCreateUserErrorRedirect(rawMessage));
  }

  const userId = created.user.id;
  try {
    const { error: profileError } = await sessionSupabase.from("profiles").insert({
      id: userId,
      full_name: payload.fullName,
      role: payload.role
    });
    if (profileError) throw profileError;

    if (manageableObjectIds.length) {
      const objectRows = manageableObjectIds.map((objectId) => ({ user_id: userId, object_id: objectId }));
      const { error: objectError } = await sessionSupabase.from("user_objects").insert(objectRows);
      if (objectError) throw objectError;
    }
  } catch (error) {
    await admin.auth.admin.deleteUser(userId).catch(() => undefined);
    throw error;
  }

  await writeAudit({
    actorId: actor.profile.id,
    action: "create_user",
    entityType: "user",
    entityId: userId,
    meta: {
      role: payload.role,
      email: payload.email,
      object_ids: payload.objectIds ?? []
    }
  });

  revalidatePath("/users");
  redirect("/users");
}

export async function updateUserAction(formData: FormData) {
  const actor = await requireProfile();
  const sessionSupabase = actor.supabase;
  if (!canManageUsersByRole(actor.profile.role)) {
    throw new Error("Нет прав на редактирование пользователей");
  }

  const payload = updateSchema.parse({
    userId: String(formData.get("user_id") ?? ""),
    fullName: String(formData.get("full_name") ?? ""),
    role: String(formData.get("role") ?? ""),
    objectIds: formData.getAll("object_ids").map(String).filter(Boolean)
  });

  if (actor.profile.id === payload.userId && payload.role !== actor.profile.role) {
    throw new Error("Нельзя менять свою роль через этот экран");
  }

  const admin = createSupabaseAdminClient();
  const { data: currentTarget, error: currentTargetError } = await sessionSupabase
    .from("profiles")
    .select("full_name,role")
    .eq("id", payload.userId)
    .maybeSingle();
  if (currentTargetError) throw currentTargetError;
  if (!currentTarget) throw new Error("\u041f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u044c \u043d\u0435 \u043d\u0430\u0439\u0434\u0435\u043d");
  if (!canManageUserRole(actor.profile.role, currentTarget.role)) {
    throw new Error("\u041d\u0435\u0442 \u043f\u0440\u0430\u0432 \u043d\u0430 \u0440\u0435\u0434\u0430\u043a\u0442\u0438\u0440\u043e\u0432\u0430\u043d\u0438\u0435 \u044d\u0442\u043e\u0433\u043e \u043f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u044f");
  }
  const manageableObjectIds = await assertManageableUserPayload(sessionSupabase, actor.profile, payload.role, payload.objectIds ?? []);
  const { data: previousLinks, error: previousLinksError } = await sessionSupabase
    .from("user_objects")
    .select("object_id")
    .eq("user_id", payload.userId);
  if (previousLinksError) throw previousLinksError;

  try {
    const { error: profileError } = await sessionSupabase
      .from("profiles")
      .update({ full_name: payload.fullName, role: payload.role })
      .eq("id", payload.userId);
    if (profileError) throw profileError;

    const { error: clearLinksError } = await sessionSupabase.from("user_objects").delete().eq("user_id", payload.userId);
    if (clearLinksError) throw clearLinksError;

    if (manageableObjectIds.length) {
      const objectRows = manageableObjectIds.map((objectId) => ({ user_id: payload.userId, object_id: objectId }));
      const { error: objectError } = await sessionSupabase.from("user_objects").insert(objectRows);
      if (objectError) throw objectError;
    }
  } catch (error) {
    await admin
      .from("profiles")
      .update({ full_name: currentTarget.full_name, role: currentTarget.role })
      .eq("id", payload.userId);
    await admin.from("user_objects").delete().eq("user_id", payload.userId);
    if ((previousLinks ?? []).length) {
      const rollbackRows = previousLinks.map((row) => ({ user_id: payload.userId, object_id: row.object_id }));
      await admin.from("user_objects").insert(rollbackRows);
    }
    throw error;
  }

  await writeAudit({
    actorId: actor.profile.id,
    action: "update_user",
    entityType: "user",
    entityId: payload.userId,
    meta: {
      role: payload.role,
      object_ids: payload.objectIds ?? []
    }
  });

  revalidatePath("/users");
}

export async function deleteUserAction(formData: FormData) {
  const actor = await requireProfile();
  const sessionSupabase = actor.supabase;
  if (!canManageUsersByRole(actor.profile.role)) {
    throw new Error("Нет прав на удаление пользователей");
  }

  const payload = deleteSchema.parse({
    userId: String(formData.get("user_id") ?? "")
  });

  if (actor.profile.id === payload.userId) {
    throw new Error("Нельзя удалить свою учетную запись");
  }

  const admin = createSupabaseAdminClient();
  const { data: currentTarget, error: currentTargetError } = await sessionSupabase
    .from("profiles")
    .select("full_name,role")
    .eq("id", payload.userId)
    .maybeSingle();
  if (currentTargetError) throw currentTargetError;
  if (!currentTarget) throw new Error("\u041f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u044c \u043d\u0435 \u043d\u0430\u0439\u0434\u0435\u043d");
  if (!canManageUserRole(actor.profile.role, currentTarget.role)) {
    throw new Error("\u041d\u0435\u0442 \u043f\u0440\u0430\u0432 \u043d\u0430 \u0443\u0434\u0430\u043b\u0435\u043d\u0438\u0435 \u044d\u0442\u043e\u0433\u043e \u043f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u044f");
  }
  const { count, error: tasksCountError } = await admin
    .from("tasks")
    .select("id", { count: "exact", head: true })
    .or(`assigned_to.eq.${payload.userId},created_by.eq.${payload.userId}`);
  if (tasksCountError) throw tasksCountError;
  if ((count ?? 0) > 0) {
    throw new Error("Нельзя удалить пользователя: есть связанные задачи");
  }

  const { data: previousLinks, error: previousLinksError } = await sessionSupabase
    .from("user_objects")
    .select("object_id")
    .eq("user_id", payload.userId);
  if (previousLinksError) throw previousLinksError;

  const { error: profileDeleteError } = await sessionSupabase.from("profiles").delete().eq("id", payload.userId);
  if (profileDeleteError) throw profileDeleteError;

  const { error: deleteError } = await admin.auth.admin.deleteUser(payload.userId);
  if (deleteError) {
    await admin.from("profiles").insert({
      id: payload.userId,
      full_name: currentTarget.full_name,
      role: currentTarget.role
    });
    if ((previousLinks ?? []).length) {
      const rollbackRows = previousLinks.map((row) => ({ user_id: payload.userId, object_id: row.object_id }));
      await admin.from("user_objects").insert(rollbackRows);
    }
    throw deleteError;
  }

  await writeAudit({
    actorId: actor.profile.id,
    action: "delete_user",
    entityType: "user",
    entityId: payload.userId,
    meta: {}
  });

  revalidatePath("/users");
}
