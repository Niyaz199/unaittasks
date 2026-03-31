"use server";

import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { writeAudit } from "@/lib/audit";
import { pprEquipmentFormSchema, pprSystemFormSchema, pprSystemGroupFormSchema } from "@/lib/ppr/validators";
import {
  canAccessPprStructureScreens,
  canAccessPprSystemGroupScreens,
  listPprManageableObjectsForProfile,
} from "@/lib/ppr/queries";
import { hasActorScopedObjectAccessForProfile } from "@/lib/access/object-scope";
import { canBeResponsibleForSystem, canManagePprStructure } from "@/lib/ppr/permissions";

async function requireSystemGroupManager() {
  const { profile } = await requireProfile();
  if (!canAccessPprSystemGroupScreens(profile.role)) {
    throw new Error("Нет доступа к справочнику групп систем ППР");
  }

  const supabase = await createSupabaseServerClient();
  return { profile, supabase };
}

async function requireStructureManager() {
  const { profile } = await requireProfile();
  if (!canAccessPprStructureScreens(profile.role)) {
    throw new Error("Нет доступа к структуре ППР");
  }

  const supabase = await createSupabaseServerClient();
  const objects = await listPprManageableObjectsForProfile(supabase, profile);
  return { profile, supabase, managedObjectIds: objects.map((item) => item.id) };
}

function assertObjectAllowed(role: string, managedObjectIds: string[], objectId: string) {
  if (role === "admin" || role === "chief") return;
  if (!managedObjectIds.includes(objectId)) {
    throw new Error("Объект недоступен для изменения структуры ППР");
  }
}

async function assertResponsibleCandidate(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  responsibleUserId: string | null | undefined,
  objectId: string
) {
  if (!responsibleUserId) return;

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", responsibleUserId)
    .single();
  if (profileError) throw profileError;
  if (!profile?.role || !canBeResponsibleForSystem(profile.role)) {
    throw new Error("Выбранный пользователь не может быть ответственным по системе");
  }

  const hasAccess = await hasActorScopedObjectAccessForProfile(
    supabase,
    { id: responsibleUserId, role: profile.role },
    objectId
  );
  if (!hasAccess) {
    throw new Error("\u041e\u0442\u0432\u0435\u0442\u0441\u0442\u0432\u0435\u043d\u043d\u044b\u0439 \u043f\u043e \u0441\u0438\u0441\u0442\u0435\u043c\u0435 \u0434\u043e\u043b\u0436\u0435\u043d \u0438\u043c\u0435\u0442\u044c \u0434\u043e\u0441\u0442\u0443\u043f \u043a \u0432\u044b\u0431\u0440\u0430\u043d\u043d\u043e\u043c\u0443 \u043e\u0431\u044a\u0435\u043a\u0442\u0443");
  }
}

async function assertSystemBelongsToObject(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  systemId: string,
  objectId: string
) {
  const { data: system, error } = await supabase.from("ppr_systems").select("object_id").eq("id", systemId).single();
  if (error) throw error;
  if (!system || system.object_id !== objectId) {
    throw new Error("Система не принадлежит выбранному объекту");
  }
}

async function assertRoomBelongsToObject(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  roomId: string,
  objectId: string
) {
  const { data: room, error } = await supabase.from("object_rooms").select("object_id").eq("id", roomId).single();
  if (error) throw error;
  if (!room || room.object_id !== objectId) {
    throw new Error("Помещение должно принадлежать выбранному объекту");
  }
}

export async function createPprSystemGroupAction(formData: FormData) {
  const { profile, supabase } = await requireSystemGroupManager();
  const payload = pprSystemGroupFormSchema.parse({
    name: String(formData.get("name") ?? ""),
    code: String(formData.get("code") ?? ""),
    isActive: formData.get("is_active") === "on",
  });

  const { data, error } = await supabase
    .from("ppr_system_groups")
    .insert({
      name: payload.name.trim(),
      code: payload.code.trim().toUpperCase(),
      is_active: payload.isActive,
    })
    .select("id")
    .single();
  if (error) throw error;

  await writeAudit({
    actorId: profile.id,
    action: "create_ppr_system_group",
    entityType: "ppr_system_group",
    entityId: data.id,
    meta: {
      code: payload.code.trim().toUpperCase(),
      is_active: payload.isActive,
    },
  });

  revalidatePath("/ppr/system-groups");
  revalidatePath("/ppr/systems");
}

export async function updatePprSystemGroupAction(formData: FormData) {
  const { profile, supabase } = await requireSystemGroupManager();
  const systemGroupId = String(formData.get("system_group_id") ?? "");
  const payload = pprSystemGroupFormSchema.parse({
    name: String(formData.get("name") ?? ""),
    code: String(formData.get("code") ?? ""),
    isActive: formData.get("is_active") === "on",
  });

  const { error } = await supabase
    .from("ppr_system_groups")
    .update({
      name: payload.name.trim(),
      code: payload.code.trim().toUpperCase(),
      is_active: payload.isActive,
    })
    .eq("id", systemGroupId);
  if (error) throw error;

  await writeAudit({
    actorId: profile.id,
    action: "update_ppr_system_group",
    entityType: "ppr_system_group",
    entityId: systemGroupId,
    meta: {
      code: payload.code.trim().toUpperCase(),
      is_active: payload.isActive,
    },
  });

  revalidatePath("/ppr/system-groups");
  revalidatePath("/ppr/systems");
}

export async function createPprSystemAction(formData: FormData) {
  const { profile, supabase, managedObjectIds } = await requireStructureManager();
  const payload = pprSystemFormSchema.parse({
    objectId: String(formData.get("object_id") ?? ""),
    systemGroupId: String(formData.get("system_group_id") ?? ""),
    name: String(formData.get("name") ?? ""),
    description: String(formData.get("description") ?? "") || null,
    responsibleUserId: String(formData.get("responsible_user_id") ?? "") || null,
    isActive: formData.get("is_active") === "on",
  });

  assertObjectAllowed(profile.role, managedObjectIds, payload.objectId);
  if (!canManagePprStructure({ id: profile.id, role: profile.role, accessibleObjectIds: managedObjectIds }, payload.objectId)) {
    throw new Error("Нет прав на создание системы ППР");
  }

  await assertResponsibleCandidate(supabase, payload.responsibleUserId, payload.objectId);

  const { data, error } = await supabase
    .from("ppr_systems")
    .insert({
      object_id: payload.objectId,
      system_group_id: payload.systemGroupId,
      name: payload.name.trim(),
      description: payload.description?.trim() || null,
      responsible_user_id: payload.responsibleUserId ?? null,
      is_active: payload.isActive,
    })
    .select("id")
    .single();
  if (error) throw error;

  await writeAudit({
    actorId: profile.id,
    action: "create_ppr_system",
    entityType: "ppr_system",
    entityId: data.id,
    meta: {
      object_id: payload.objectId,
      system_group_id: payload.systemGroupId,
      responsible_user_id: payload.responsibleUserId ?? null,
    },
  });

  revalidatePath("/ppr/systems");
}

export async function updatePprSystemAction(formData: FormData) {
  const { profile, supabase, managedObjectIds } = await requireStructureManager();
  const systemId = String(formData.get("system_id") ?? "");
  const payload = pprSystemFormSchema.parse({
    objectId: String(formData.get("object_id") ?? ""),
    systemGroupId: String(formData.get("system_group_id") ?? ""),
    name: String(formData.get("name") ?? ""),
    description: String(formData.get("description") ?? "") || null,
    responsibleUserId: String(formData.get("responsible_user_id") ?? "") || null,
    isActive: formData.get("is_active") === "on",
  });

  assertObjectAllowed(profile.role, managedObjectIds, payload.objectId);
  if (!canManagePprStructure({ id: profile.id, role: profile.role, accessibleObjectIds: managedObjectIds }, payload.objectId)) {
    throw new Error("Нет прав на изменение системы ППР");
  }

  await assertResponsibleCandidate(supabase, payload.responsibleUserId, payload.objectId);

  const { error } = await supabase
    .from("ppr_systems")
    .update({
      object_id: payload.objectId,
      system_group_id: payload.systemGroupId,
      name: payload.name.trim(),
      description: payload.description?.trim() || null,
      responsible_user_id: payload.responsibleUserId ?? null,
      is_active: payload.isActive,
    })
    .eq("id", systemId);
  if (error) throw error;

  await writeAudit({
    actorId: profile.id,
    action: "update_ppr_system",
    entityType: "ppr_system",
    entityId: systemId,
    meta: {
      object_id: payload.objectId,
      system_group_id: payload.systemGroupId,
      responsible_user_id: payload.responsibleUserId ?? null,
    },
  });

  revalidatePath("/ppr/systems");
}

export async function createPprEquipmentAction(formData: FormData) {
  const { profile, supabase, managedObjectIds } = await requireStructureManager();
  const payload = pprEquipmentFormSchema.parse({
    objectId: String(formData.get("object_id") ?? ""),
    systemId: String(formData.get("system_id") ?? ""),
    roomId: String(formData.get("room_id") ?? ""),
    inventoryNo: String(formData.get("inventory_no") ?? "") || null,
    name: String(formData.get("name") ?? ""),
    dispatchName: String(formData.get("dispatch_name") ?? ""),
    serviceStartDate: String(formData.get("service_start_date") ?? ""),
    status: String(formData.get("status") ?? "active"),
    serialNo: String(formData.get("serial_no") ?? "") || null,
    manufacturer: String(formData.get("manufacturer") ?? "") || null,
    model: String(formData.get("model") ?? "") || null,
    description: String(formData.get("description") ?? "") || null,
    comment: String(formData.get("comment") ?? "") || null,
  });

  assertObjectAllowed(profile.role, managedObjectIds, payload.objectId);
  if (!canManagePprStructure({ id: profile.id, role: profile.role, accessibleObjectIds: managedObjectIds }, payload.objectId)) {
    throw new Error("Нет прав на создание оборудования ППР");
  }

  await assertSystemBelongsToObject(supabase, payload.systemId, payload.objectId);
  await assertRoomBelongsToObject(supabase, payload.roomId, payload.objectId);

  const { data, error } = await supabase
    .from("ppr_equipment")
    .insert({
      object_id: payload.objectId,
      system_id: payload.systemId,
      room_id: payload.roomId,
      inventory_no: payload.inventoryNo?.trim() || null,
      name: payload.name.trim(),
      dispatch_name: payload.dispatchName.trim(),
      service_start_date: payload.serviceStartDate,
      status: payload.status,
      serial_no: payload.serialNo?.trim() || null,
      manufacturer: payload.manufacturer?.trim() || null,
      model: payload.model?.trim() || null,
      description: payload.description?.trim() || null,
      comment: payload.comment?.trim() || null,
    })
    .select("id,inventory_no")
    .single();
  if (error) throw error;

  await writeAudit({
    actorId: profile.id,
    action: "create_ppr_equipment",
    entityType: "ppr_equipment",
    entityId: data.id,
    meta: {
      object_id: payload.objectId,
      system_id: payload.systemId,
      room_id: payload.roomId,
      inventory_no: data.inventory_no,
      status: payload.status,
    },
  });

  revalidatePath("/ppr/equipment");
}

export async function updatePprEquipmentAction(formData: FormData) {
  const { profile, supabase, managedObjectIds } = await requireStructureManager();
  const equipmentId = String(formData.get("equipment_id") ?? "");
  const payload = pprEquipmentFormSchema.parse({
    objectId: String(formData.get("object_id") ?? ""),
    systemId: String(formData.get("system_id") ?? ""),
    roomId: String(formData.get("room_id") ?? ""),
    inventoryNo: String(formData.get("inventory_no") ?? "") || null,
    name: String(formData.get("name") ?? ""),
    dispatchName: String(formData.get("dispatch_name") ?? ""),
    serviceStartDate: String(formData.get("service_start_date") ?? ""),
    status: String(formData.get("status") ?? "active"),
    serialNo: String(formData.get("serial_no") ?? "") || null,
    manufacturer: String(formData.get("manufacturer") ?? "") || null,
    model: String(formData.get("model") ?? "") || null,
    description: String(formData.get("description") ?? "") || null,
    comment: String(formData.get("comment") ?? "") || null,
  });

  assertObjectAllowed(profile.role, managedObjectIds, payload.objectId);
  if (!canManagePprStructure({ id: profile.id, role: profile.role, accessibleObjectIds: managedObjectIds }, payload.objectId)) {
    throw new Error("Нет прав на изменение оборудования ППР");
  }
  if (!payload.inventoryNo?.trim()) {
    throw new Error("Инвентарный номер обязателен при редактировании оборудования");
  }

  await assertSystemBelongsToObject(supabase, payload.systemId, payload.objectId);
  await assertRoomBelongsToObject(supabase, payload.roomId, payload.objectId);

  const { error } = await supabase
    .from("ppr_equipment")
    .update({
      object_id: payload.objectId,
      system_id: payload.systemId,
      room_id: payload.roomId,
      inventory_no: payload.inventoryNo.trim(),
      name: payload.name.trim(),
      dispatch_name: payload.dispatchName.trim(),
      service_start_date: payload.serviceStartDate,
      status: payload.status,
      serial_no: payload.serialNo?.trim() || null,
      manufacturer: payload.manufacturer?.trim() || null,
      model: payload.model?.trim() || null,
      description: payload.description?.trim() || null,
      comment: payload.comment?.trim() || null,
    })
    .eq("id", equipmentId);
  if (error) throw error;

  await writeAudit({
    actorId: profile.id,
    action: "update_ppr_equipment",
    entityType: "ppr_equipment",
    entityId: equipmentId,
    meta: {
      object_id: payload.objectId,
      system_id: payload.systemId,
      room_id: payload.roomId,
      inventory_no: payload.inventoryNo.trim(),
      status: payload.status,
    },
  });

  revalidatePath("/ppr/equipment");
  revalidatePath(`/ppr/equipment/${equipmentId}`);
}
