"use server";

import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { writeAudit } from "@/lib/audit";
import {
  canManageObjectRooms,
  listObjectRoomManageableObjectsForProfile,
  normalizeObjectRoomName,
  objectRoomFormSchema,
  sanitizeObjectRoomName,
} from "@/lib/object-rooms";

type SupabaseServer = Awaited<ReturnType<typeof createSupabaseServerClient>>;
type ObjectRoomActionResult = { ok: true } | { ok: false; error: string };

const OBJECT_ROOM_UNIQUE_CONSTRAINTS = new Set([
  "object_rooms_object_floor_normalized_name_unique",
  "object_rooms_object_id_name_key",
]);

function normalizeDbError(error: unknown): never {
  const code = typeof error === "object" && error && "code" in error ? String((error as { code?: string }).code ?? "") : "";
  const constraint =
    typeof error === "object" && error && "constraint" in error
      ? String((error as { constraint?: string }).constraint ?? "")
      : "";
  const message =
    typeof error === "object" && error && "message" in error ? String((error as { message?: string }).message ?? "") : "";

  if (
    code === "23505" &&
    (OBJECT_ROOM_UNIQUE_CONSTRAINTS.has(constraint) ||
      [...OBJECT_ROOM_UNIQUE_CONSTRAINTS].some((item) => message.includes(item)))
  ) {
    throw new Error("Помещение с таким названием уже существует на выбранном объекте и этаже");
  }

  if (code === "PGRST205") {
    throw new Error(
      "Supabase ещё не обновил schema cache для таблицы помещений. Выполните `NOTIFY pgrst, 'reload schema';` в SQL Editor и повторите попытку."
    );
  }

  throw error instanceof Error ? error : new Error("Не удалось сохранить помещение");
}

function assertObjectAllowed(role: string, managedObjectIds: string[], objectId: string) {
  if (role === "admin" || role === "chief") return;
  if (!managedObjectIds.includes(objectId)) {
    throw new Error("Объект недоступен для изменения справочника помещений");
  }
}

async function requireObjectRoomManager() {
  const { profile } = await requireProfile();
  if (!canManageObjectRooms(profile.role)) {
    throw new Error("Нет доступа к справочнику помещений");
  }

  const supabase = await createSupabaseServerClient();
  const objects = await listObjectRoomManageableObjectsForProfile(supabase, profile);
  return { profile, supabase, managedObjectIds: objects.map((item) => item.id) };
}

async function assertRoomManageable(
  supabase: SupabaseServer,
  role: string,
  managedObjectIds: string[],
  roomId: string
) {
  const { data: room, error } = await supabase
    .from("object_rooms")
    .select("object_id,floor_id,room_type_id")
    .eq("id", roomId)
    .single();
  if (error) throw error;
  if (!room) {
    throw new Error("Помещение не найдено");
  }
  if (role !== "admin" && role !== "chief" && !managedObjectIds.includes(room.object_id)) {
    throw new Error("Помещение недоступно для изменения");
  }
  return room;
}

async function resolveFloorSelection(
  supabase: SupabaseServer,
  floorId: string | null | undefined,
  objectId: string,
  currentFloorId?: string | null
) {
  if (!floorId) {
    throw new Error("Выберите этаж");
  }

  const { data: floor, error } = await supabase
    .from("floors")
    .select("id,object_id,name,is_active")
    .eq("id", floorId)
    .single();
  if (error) throw error;
  if (!floor || floor.object_id !== objectId) {
    throw new Error("Этаж должен принадлежать выбранному объекту");
  }
  if (!floor.is_active && floor.id !== currentFloorId) {
    throw new Error("Нельзя выбрать неактивный этаж");
  }
  return floor;
}

async function resolveRoomTypeSelection(
  supabase: SupabaseServer,
  roomTypeId: string | null | undefined,
  currentRoomTypeId?: string | null
) {
  if (!roomTypeId) {
    throw new Error("Выберите тип помещения");
  }

  const { data: roomType, error } = await supabase
    .from("room_types")
    .select("id,name,is_active")
    .eq("id", roomTypeId)
    .single();
  if (error) throw error;
  if (!roomType) {
    throw new Error("Тип помещения не найден");
  }
  if (!roomType.is_active && roomType.id !== currentRoomTypeId) {
    throw new Error("Нельзя выбрать неактивный тип помещения");
  }
  return roomType;
}

export async function createObjectRoomAction(formData: FormData) {
  const { profile, supabase, managedObjectIds } = await requireObjectRoomManager();
  const payload = objectRoomFormSchema.parse({
    objectId: String(formData.get("object_id") ?? ""),
    name: String(formData.get("name") ?? ""),
    floorId: String(formData.get("floor_id") ?? "") || null,
    roomTypeId: String(formData.get("room_type_id") ?? "") || null,
    description: String(formData.get("description") ?? "") || null,
    isActive: formData.get("is_active") === "on",
  });

  assertObjectAllowed(profile.role, managedObjectIds, payload.objectId);
  const floor = await resolveFloorSelection(supabase, payload.floorId, payload.objectId);
  const roomType = await resolveRoomTypeSelection(supabase, payload.roomTypeId);
  const normalizedName = normalizeObjectRoomName(payload.name);

  if (!normalizedName) {
    throw new Error("Название помещения пустое после нормализации");
  }

  let data: { id: string };
  try {
    const result = await supabase
      .from("object_rooms")
      .insert({
        object_id: payload.objectId,
        name: sanitizeObjectRoomName(payload.name),
        floor: floor.name,
        floor_id: floor.id,
        room_type_id: roomType.id,
        description: payload.description?.trim() || null,
        is_active: payload.isActive,
      })
      .select("id")
      .single();
    if (result.error) throw result.error;
    data = result.data;
  } catch (error) {
    normalizeDbError(error);
  }

  await writeAudit({
    actorId: profile.id,
    action: "create_object_room",
    entityType: "object_room",
    entityId: data.id,
    meta: {
      object_id: payload.objectId,
      floor: floor.name,
      floor_id: floor.id,
      room_type_id: roomType.id,
    },
  });

  revalidatePath("/directories/floors");
  revalidatePath("/directories/room-types");
  revalidatePath("/ppr/rooms");
  revalidatePath(`/ppr/rooms/${data.id}`);
  revalidatePath("/ppr/equipment");
  revalidatePath("/rounds/config");
  revalidatePath("/rounds/today");
  revalidatePath("/rounds/archive");
  revalidatePath("/rounds/qr");
}

export async function updateObjectRoomAction(formData: FormData) {
  const { profile, supabase, managedObjectIds } = await requireObjectRoomManager();
  const roomId = String(formData.get("room_id") ?? "");
  const payload = objectRoomFormSchema.parse({
    objectId: String(formData.get("object_id") ?? ""),
    name: String(formData.get("name") ?? ""),
    floorId: String(formData.get("floor_id") ?? "") || null,
    roomTypeId: String(formData.get("room_type_id") ?? "") || null,
    description: String(formData.get("description") ?? "") || null,
    isActive: formData.get("is_active") === "on",
  });

  assertObjectAllowed(profile.role, managedObjectIds, payload.objectId);
  const currentRoom = await assertRoomManageable(supabase, profile.role, managedObjectIds, roomId);
  const floor = await resolveFloorSelection(supabase, payload.floorId, payload.objectId, currentRoom.floor_id);
  const roomType = await resolveRoomTypeSelection(supabase, payload.roomTypeId, currentRoom.room_type_id);
  const normalizedName = normalizeObjectRoomName(payload.name);

  if (!normalizedName) {
    throw new Error("Название помещения пустое после нормализации");
  }

  try {
    const { error } = await supabase
      .from("object_rooms")
      .update({
        object_id: payload.objectId,
        name: sanitizeObjectRoomName(payload.name),
        floor: floor.name,
        floor_id: floor.id,
        room_type_id: roomType.id,
        description: payload.description?.trim() || null,
        is_active: payload.isActive,
      })
      .eq("id", roomId);
    if (error) throw error;
  } catch (error) {
    normalizeDbError(error);
  }

  await writeAudit({
    actorId: profile.id,
    action: "update_object_room",
    entityType: "object_room",
    entityId: roomId,
    meta: {
      object_id: payload.objectId,
      floor: floor.name,
      floor_id: floor.id,
      room_type_id: roomType.id,
    },
  });

  revalidatePath("/directories/floors");
  revalidatePath("/directories/room-types");
  revalidatePath("/ppr/rooms");
  revalidatePath(`/ppr/rooms/${roomId}`);
  revalidatePath("/ppr/equipment");
  revalidatePath("/rounds/config");
  revalidatePath("/rounds/today");
  revalidatePath("/rounds/archive");
  revalidatePath("/rounds/qr");
}

export async function createObjectRoomActionSafe(formData: FormData): Promise<ObjectRoomActionResult> {
  try {
    await createObjectRoomAction(formData);
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Не удалось создать помещение",
    };
  }
}

export async function updateObjectRoomActionSafe(formData: FormData): Promise<ObjectRoomActionResult> {
  try {
    await updateObjectRoomAction(formData);
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Не удалось сохранить помещение",
    };
  }
}
