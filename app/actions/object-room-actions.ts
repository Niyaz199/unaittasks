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
  const { data: room, error } = await supabase.from("object_rooms").select("object_id").eq("id", roomId).single();
  if (error) throw error;
  if (!room) {
    throw new Error("Помещение не найдено");
  }
  if (role !== "admin" && role !== "chief" && !managedObjectIds.includes(room.object_id)) {
    throw new Error("Помещение недоступно для изменения");
  }
}

export async function createObjectRoomAction(formData: FormData) {
  const { profile, supabase, managedObjectIds } = await requireObjectRoomManager();
  const payload = objectRoomFormSchema.parse({
    objectId: String(formData.get("object_id") ?? ""),
    name: String(formData.get("name") ?? ""),
    floor: String(formData.get("floor") ?? "") || null,
    description: String(formData.get("description") ?? "") || null,
    isActive: formData.get("is_active") === "on",
  });

  assertObjectAllowed(profile.role, managedObjectIds, payload.objectId);

  const { data, error } = await supabase
    .from("object_rooms")
    .insert({
      object_id: payload.objectId,
      name: payload.name.trim(),
      floor: payload.floor?.trim() || null,
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
      floor: payload.floor?.trim() || null,
    },
  });

  revalidatePath("/ppr/rooms");
  revalidatePath("/ppr/equipment");
}

export async function updateObjectRoomAction(formData: FormData) {
  const { profile, supabase, managedObjectIds } = await requireObjectRoomManager();
  const roomId = String(formData.get("room_id") ?? "");
  const payload = objectRoomFormSchema.parse({
    objectId: String(formData.get("object_id") ?? ""),
    name: String(formData.get("name") ?? ""),
    floor: String(formData.get("floor") ?? "") || null,
    description: String(formData.get("description") ?? "") || null,
    isActive: formData.get("is_active") === "on",
  });

  assertObjectAllowed(profile.role, managedObjectIds, payload.objectId);
  await assertRoomManageable(supabase, profile.role, managedObjectIds, roomId);

  const { error } = await supabase
    .from("object_rooms")
    .update({
      object_id: payload.objectId,
      name: payload.name.trim(),
      floor: payload.floor?.trim() || null,
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
      floor: payload.floor?.trim() || null,
    },
  });

  revalidatePath("/ppr/rooms");
  revalidatePath("/ppr/equipment");
}
