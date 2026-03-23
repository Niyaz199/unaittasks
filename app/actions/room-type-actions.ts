"use server";

import { revalidatePath } from "next/cache";
import { requireProfile, canManageRoomTypesDirectory } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { roomTypeFormSchema } from "@/lib/room-types";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function parseSortOrder(rawValue: FormDataEntryValue | null) {
  const raw = String(rawValue ?? "").trim();
  if (!raw) return null;
  const value = Number(raw);
  if (!Number.isInteger(value)) {
    throw new Error("Порядок сортировки должен быть целым числом");
  }
  return value;
}

function normalizeDbError(error: unknown) {
  if (typeof error === "object" && error && "code" in error && (error as { code?: string }).code === "23505") {
    throw new Error("Активный тип помещения с таким названием уже существует");
  }
  if (typeof error === "object" && error && "code" in error && (error as { code?: string }).code === "PGRST205") {
    throw new Error("Supabase ещё не обновил schema cache для таблицы типов помещений. Выполните `NOTIFY pgrst, 'reload schema';` в SQL Editor и повторите попытку.");
  }
  throw error;
}

async function requireRoomTypeManager() {
  const { profile } = await requireProfile();
  if (!canManageRoomTypesDirectory(profile.role)) {
    throw new Error("Нет доступа к справочнику типов помещений");
  }

  const supabase = await createSupabaseServerClient();
  return { profile, supabase };
}

async function revalidateRoomTypeConsumers() {
  revalidatePath("/directories/room-types");
  revalidatePath("/ppr/rooms");
}

export async function createRoomTypeAction(formData: FormData) {
  const { profile, supabase } = await requireRoomTypeManager();
  const payload = roomTypeFormSchema.parse({
    name: String(formData.get("name") ?? ""),
    description: String(formData.get("description") ?? "") || null,
    sortOrder: parseSortOrder(formData.get("sort_order")),
    isActive: formData.get("is_active") === "on",
  });

  try {
    const { data, error } = await supabase
      .from("room_types")
      .insert({
        name: payload.name.trim(),
        description: payload.description?.trim() || null,
        sort_order: payload.sortOrder,
        is_active: payload.isActive,
      })
      .select("id")
      .single();
    if (error) throw error;

    await writeAudit({
      actorId: profile.id,
      action: "create_room_type",
      entityType: "room_type",
      entityId: data.id,
      meta: {
        name: payload.name.trim(),
        description: payload.description?.trim() || null,
        sort_order: payload.sortOrder,
        is_active: payload.isActive,
      },
    });
  } catch (error) {
    normalizeDbError(error);
  }

  await revalidateRoomTypeConsumers();
}

export async function updateRoomTypeAction(formData: FormData) {
  const { profile, supabase } = await requireRoomTypeManager();
  const roomTypeId = String(formData.get("room_type_id") ?? "");
  const payload = roomTypeFormSchema.parse({
    name: String(formData.get("name") ?? ""),
    description: String(formData.get("description") ?? "") || null,
    sortOrder: parseSortOrder(formData.get("sort_order")),
    isActive: formData.get("is_active") === "on",
  });

  try {
    const { error } = await supabase
      .from("room_types")
      .update({
        name: payload.name.trim(),
        description: payload.description?.trim() || null,
        sort_order: payload.sortOrder,
        is_active: payload.isActive,
      })
      .eq("id", roomTypeId);
    if (error) throw error;

    await writeAudit({
      actorId: profile.id,
      action: "update_room_type",
      entityType: "room_type",
      entityId: roomTypeId,
      meta: {
        name: payload.name.trim(),
        description: payload.description?.trim() || null,
        sort_order: payload.sortOrder,
        is_active: payload.isActive,
      },
    });
  } catch (error) {
    normalizeDbError(error);
  }

  await revalidateRoomTypeConsumers();
}

export async function deleteRoomTypeAction(formData: FormData) {
  const { profile, supabase } = await requireRoomTypeManager();
  const roomTypeId = String(formData.get("room_type_id") ?? "");

  const { count, error: usageError } = await supabase
    .from("object_rooms")
    .select("id", { count: "exact", head: true })
    .eq("room_type_id", roomTypeId);
  if (usageError) throw usageError;
  if ((count ?? 0) > 0) {
    throw new Error("Нельзя удалить тип помещения: он используется помещениями");
  }

  const { error } = await supabase.from("room_types").delete().eq("id", roomTypeId);
  if (error) throw error;

  await writeAudit({
    actorId: profile.id,
    action: "delete_room_type",
    entityType: "room_type",
    entityId: roomTypeId,
    meta: {},
  });

  await revalidateRoomTypeConsumers();
}
