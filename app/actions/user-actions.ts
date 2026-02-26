"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { canManageUsers, requireProfile } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
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

function buildCreateUserErrorRedirect(message: string) {
  return `/users/create?error=${encodeURIComponent(message)}`;
}

export async function createUserAction(formData: FormData) {
  const actor = await requireProfile();
  if (!canManageUsers(actor.profile.role)) {
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
  const { error: profileError } = await admin.from("profiles").upsert({
    id: userId,
    full_name: payload.fullName,
    role: payload.role
  });
  if (profileError) throw profileError;

  if (payload.role === "engineer" || payload.role === "object_engineer") {
    const objectRows = (payload.objectIds ?? []).map((objectId) => ({ user_id: userId, object_id: objectId }));
    if (objectRows.length) {
      const { error: objectError } = await admin.from("user_objects").insert(objectRows);
      if (objectError) throw objectError;
    }
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
  if (!canManageUsers(actor.profile.role)) {
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
  const { error: profileError } = await admin
    .from("profiles")
    .update({ full_name: payload.fullName, role: payload.role })
    .eq("id", payload.userId);
  if (profileError) throw profileError;

  const { error: clearLinksError } = await admin.from("user_objects").delete().eq("user_id", payload.userId);
  if (clearLinksError) throw clearLinksError;

  if (payload.role === "engineer" || payload.role === "object_engineer") {
    const uniqueObjectIds = [...new Set(payload.objectIds ?? [])];
    if (uniqueObjectIds.length) {
      const objectRows = uniqueObjectIds.map((objectId) => ({ user_id: payload.userId, object_id: objectId }));
      const { error: objectError } = await admin.from("user_objects").insert(objectRows);
      if (objectError) throw objectError;
    }
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
  if (!canManageUsers(actor.profile.role)) {
    throw new Error("Нет прав на удаление пользователей");
  }

  const payload = deleteSchema.parse({
    userId: String(formData.get("user_id") ?? "")
  });

  if (actor.profile.id === payload.userId) {
    throw new Error("Нельзя удалить свою учетную запись");
  }

  const admin = createSupabaseAdminClient();
  const { count, error: tasksCountError } = await admin
    .from("tasks")
    .select("id", { count: "exact", head: true })
    .or(`assigned_to.eq.${payload.userId},created_by.eq.${payload.userId}`);
  if (tasksCountError) throw tasksCountError;
  if ((count ?? 0) > 0) {
    throw new Error("Нельзя удалить пользователя: есть связанные задачи");
  }

  const { error: deleteError } = await admin.auth.admin.deleteUser(payload.userId);
  if (deleteError) throw deleteError;

  await writeAudit({
    actorId: actor.profile.id,
    action: "delete_user",
    entityType: "user",
    entityId: payload.userId,
    meta: {}
  });

  revalidatePath("/users");
}
