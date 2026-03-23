"use server";

import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { inferFloorSortOrder, floorFormSchema } from "@/lib/floors";
import { listObjectRoomManageableObjectsForProfile } from "@/lib/object-rooms";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type SupabaseServer = Awaited<ReturnType<typeof createSupabaseServerClient>>;

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
    throw new Error("Этаж с таким названием уже существует для выбранного объекта");
  }
  if (typeof error === "object" && error && "code" in error && (error as { code?: string }).code === "PGRST205") {
    throw new Error("Supabase ещё не обновил schema cache для таблицы этажей. Выполните `NOTIFY pgrst, 'reload schema';` в SQL Editor и повторите попытку.");
  }
  throw error;
}

function assertObjectAllowed(role: string, managedObjectIds: string[], objectId: string) {
  if (role === "admin" || role === "chief") return;
  if (!managedObjectIds.includes(objectId)) {
    throw new Error("Объект недоступен для изменения справочника этажей");
  }
}

async function requireFloorManager() {
  const { profile } = await requireProfile();
  const supabase = await createSupabaseServerClient();
  const objects = await listObjectRoomManageableObjectsForProfile(supabase, profile);
  return { profile, supabase, managedObjectIds: objects.map((item) => item.id) };
}

async function assertFloorManageable(
  supabase: SupabaseServer,
  role: string,
  managedObjectIds: string[],
  floorId: string
) {
  const { data: floor, error } = await supabase.from("floors").select("object_id").eq("id", floorId).single();
  if (error) throw error;
  if (!floor) {
    throw new Error("Этаж не найден");
  }
  assertObjectAllowed(role, managedObjectIds, floor.object_id);
  return floor;
}

async function revalidateFloorConsumers() {
  revalidatePath("/directories/floors");
  revalidatePath("/ppr/rooms");
  revalidatePath("/ppr/equipment");
  revalidatePath("/ppr/calendar");
}

export async function createFloorAction(formData: FormData) {
  const { profile, supabase, managedObjectIds } = await requireFloorManager();
  const payload = floorFormSchema.parse({
    objectId: String(formData.get("object_id") ?? ""),
    name: String(formData.get("name") ?? ""),
    sortOrder: parseSortOrder(formData.get("sort_order")),
    isActive: formData.get("is_active") === "on",
  });

  assertObjectAllowed(profile.role, managedObjectIds, payload.objectId);

  try {
    const { data, error } = await supabase
      .from("floors")
      .insert({
        object_id: payload.objectId,
        name: payload.name.trim(),
        sort_order: payload.sortOrder ?? inferFloorSortOrder(payload.name),
        is_active: payload.isActive,
      })
      .select("id")
      .single();
    if (error) throw error;

    await writeAudit({
      actorId: profile.id,
      action: "create_floor",
      entityType: "floor",
      entityId: data.id,
      meta: {
        object_id: payload.objectId,
        name: payload.name.trim(),
        sort_order: payload.sortOrder ?? inferFloorSortOrder(payload.name),
        is_active: payload.isActive,
      },
    });
  } catch (error) {
    normalizeDbError(error);
  }

  await revalidateFloorConsumers();
}

export async function updateFloorAction(formData: FormData) {
  const { profile, supabase, managedObjectIds } = await requireFloorManager();
  const floorId = String(formData.get("floor_id") ?? "");
  const payload = floorFormSchema.parse({
    objectId: String(formData.get("object_id") ?? ""),
    name: String(formData.get("name") ?? ""),
    sortOrder: parseSortOrder(formData.get("sort_order")),
    isActive: formData.get("is_active") === "on",
  });

  await assertFloorManageable(supabase, profile.role, managedObjectIds, floorId);
  assertObjectAllowed(profile.role, managedObjectIds, payload.objectId);

  try {
    const { error } = await supabase
      .from("floors")
      .update({
        object_id: payload.objectId,
        name: payload.name.trim(),
        sort_order: payload.sortOrder ?? inferFloorSortOrder(payload.name),
        is_active: payload.isActive,
      })
      .eq("id", floorId);
    if (error) throw error;

    await writeAudit({
      actorId: profile.id,
      action: "update_floor",
      entityType: "floor",
      entityId: floorId,
      meta: {
        object_id: payload.objectId,
        name: payload.name.trim(),
        sort_order: payload.sortOrder ?? inferFloorSortOrder(payload.name),
        is_active: payload.isActive,
      },
    });
  } catch (error) {
    normalizeDbError(error);
  }

  await revalidateFloorConsumers();
}

export async function deleteFloorAction(formData: FormData) {
  const { profile, supabase, managedObjectIds } = await requireFloorManager();
  const floorId = String(formData.get("floor_id") ?? "");

  await assertFloorManageable(supabase, profile.role, managedObjectIds, floorId);

  const { count, error: usageError } = await supabase
    .from("object_rooms")
    .select("id", { count: "exact", head: true })
    .eq("floor_id", floorId);
  if (usageError) throw usageError;
  if ((count ?? 0) > 0) {
    throw new Error("Нельзя удалить этаж: он используется помещениями");
  }

  const { error } = await supabase.from("floors").delete().eq("id", floorId);
  if (error) throw error;

  await writeAudit({
    actorId: profile.id,
    action: "delete_floor",
    entityType: "floor",
    entityId: floorId,
    meta: {},
  });

  await revalidateFloorConsumers();
}
