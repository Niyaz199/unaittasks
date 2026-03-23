"use server";

import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { writeAudit } from "@/lib/audit";
import {
  canManageObjectRooms,
  listObjectRoomManageableObjectsForProfile,
  objectRoomFormSchema,
} from "@/lib/object-rooms";

type SupabaseServer = Awaited<ReturnType<typeof createSupabaseServerClient>>;

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

  const { data, error } = await supabase
    .from("object_rooms")
    .insert({
      object_id: payload.objectId,
      name: payload.name.trim(),
      floor: floor.name,
      floor_id: floor.id,
      room_type_id: roomType.id,
      description: payload.description?.trim() || null,
      is_active: payload.isActive,
    })
    .select("id")
    .single();
  if (error) throw error;

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
  revalidatePath("/ppr/equipment");
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

  const { error } = await supabase
    .from("object_rooms")
    .update({
      object_id: payload.objectId,
      name: payload.name.trim(),
      floor: floor.name,
      floor_id: floor.id,
      room_type_id: roomType.id,
      description: payload.description?.trim() || null,
      is_active: payload.isActive,
    })
    .eq("id", roomId);
  if (error) throw error;

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
  revalidatePath("/ppr/equipment");
}
