"use server";

import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { writeAudit } from "@/lib/audit";
import {
  pprEquipmentFormSchema,
  pprRoomFormSchema,
  pprSubsystemFormSchema,
  pprSystemFormSchema,
  pprSystemGroupFormSchema,
} from "@/lib/ppr/validators";
import {
  canAccessPprStructureScreens,
  canAccessPprSystemGroupScreens,
  listPprManageableObjectsForProfile,
} from "@/lib/ppr/queries";
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

  const { count, error: accessError } = await supabase
    .from("user_objects")
    .select("object_id", { count: "exact", head: true })
    .eq("user_id", responsibleUserId)
    .eq("object_id", objectId);
  if (accessError) throw accessError;

  if ((count ?? 0) === 0) {
    throw new Error("Ответственный по системе должен иметь доступ к выбранному объекту");
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

async function assertParentBelongsToSystem(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  parentId: string | null | undefined,
  systemId: string
) {
  if (!parentId) return;
  const { data: parent, error } = await supabase.from("ppr_subsystems").select("system_id").eq("id", parentId).single();
  if (error) throw error;
  if (!parent || parent.system_id !== systemId) {
    throw new Error("Родительская подсистема не принадлежит выбранной системе");
  }
}

async function assertSubsystemBelongsToSystemAndObject(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  subsystemId: string,
  systemId: string,
  objectId: string
) {
  const { data: subsystem, error } = await supabase
    .from("ppr_subsystems")
    .select("object_id,system_id")
    .eq("id", subsystemId)
    .single();
  if (error) throw error;
  if (!subsystem || subsystem.object_id !== objectId || subsystem.system_id !== systemId) {
    throw new Error("Подсистема должна принадлежать выбранной системе и объекту");
  }
}

async function assertRoomBelongsToObject(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  roomId: string,
  objectId: string
) {
  const { data: room, error } = await supabase.from("ppr_rooms").select("object_id").eq("id", roomId).single();
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

export async function createPprSubsystemAction(formData: FormData) {
  const { profile, supabase, managedObjectIds } = await requireStructureManager();
  const payload = pprSubsystemFormSchema.parse({
    objectId: String(formData.get("object_id") ?? ""),
    systemId: String(formData.get("system_id") ?? ""),
    parentId: String(formData.get("parent_id") ?? "") || null,
    name: String(formData.get("name") ?? ""),
    sortOrder: Number(formData.get("sort_order") ?? 0),
    isActive: formData.get("is_active") === "on",
  });

  assertObjectAllowed(profile.role, managedObjectIds, payload.objectId);
  if (!canManagePprStructure({ id: profile.id, role: profile.role, accessibleObjectIds: managedObjectIds }, payload.objectId)) {
    throw new Error("Нет прав на создание подсистемы ППР");
  }

  await assertSystemBelongsToObject(supabase, payload.systemId, payload.objectId);
  await assertParentBelongsToSystem(supabase, payload.parentId, payload.systemId);

  const { data, error } = await supabase
    .from("ppr_subsystems")
    .insert({
      object_id: payload.objectId,
      system_id: payload.systemId,
      parent_id: payload.parentId ?? null,
      name: payload.name.trim(),
      sort_order: payload.sortOrder,
      is_active: payload.isActive,
    })
    .select("id")
    .single();
  if (error) throw error;

  await writeAudit({
    actorId: profile.id,
    action: "create_ppr_subsystem",
    entityType: "ppr_subsystem",
    entityId: data.id,
    meta: {
      object_id: payload.objectId,
      system_id: payload.systemId,
      parent_id: payload.parentId ?? null,
      sort_order: payload.sortOrder,
    },
  });

  revalidatePath("/ppr/subsystems");
}

export async function updatePprSubsystemAction(formData: FormData) {
  const { profile, supabase, managedObjectIds } = await requireStructureManager();
  const subsystemId = String(formData.get("subsystem_id") ?? "");
  const payload = pprSubsystemFormSchema.parse({
    objectId: String(formData.get("object_id") ?? ""),
    systemId: String(formData.get("system_id") ?? ""),
    parentId: String(formData.get("parent_id") ?? "") || null,
    name: String(formData.get("name") ?? ""),
    sortOrder: Number(formData.get("sort_order") ?? 0),
    isActive: formData.get("is_active") === "on",
  });

  assertObjectAllowed(profile.role, managedObjectIds, payload.objectId);
  if (!canManagePprStructure({ id: profile.id, role: profile.role, accessibleObjectIds: managedObjectIds }, payload.objectId)) {
    throw new Error("Нет прав на изменение подсистемы ППР");
  }

  await assertSystemBelongsToObject(supabase, payload.systemId, payload.objectId);
  await assertParentBelongsToSystem(supabase, payload.parentId, payload.systemId);
  if (payload.parentId === subsystemId) throw new Error("Подсистема не может быть родителем самой себе");

  const { error } = await supabase
    .from("ppr_subsystems")
    .update({
      object_id: payload.objectId,
      system_id: payload.systemId,
      parent_id: payload.parentId ?? null,
      name: payload.name.trim(),
      sort_order: payload.sortOrder,
      is_active: payload.isActive,
    })
    .eq("id", subsystemId);
  if (error) throw error;

  await writeAudit({
    actorId: profile.id,
    action: "update_ppr_subsystem",
    entityType: "ppr_subsystem",
    entityId: subsystemId,
    meta: {
      object_id: payload.objectId,
      system_id: payload.systemId,
      parent_id: payload.parentId ?? null,
      sort_order: payload.sortOrder,
    },
  });

  revalidatePath("/ppr/subsystems");
}

export async function createPprRoomAction(formData: FormData) {
  const { profile, supabase, managedObjectIds } = await requireStructureManager();
  const payload = pprRoomFormSchema.parse({
    objectId: String(formData.get("object_id") ?? ""),
    name: String(formData.get("name") ?? ""),
    floor: String(formData.get("floor") ?? "") || null,
    description: String(formData.get("description") ?? "") || null,
    isActive: formData.get("is_active") === "on",
  });

  assertObjectAllowed(profile.role, managedObjectIds, payload.objectId);
  if (!canManagePprStructure({ id: profile.id, role: profile.role, accessibleObjectIds: managedObjectIds }, payload.objectId)) {
    throw new Error("Нет прав на создание помещения ППР");
  }

  const { data, error } = await supabase
    .from("ppr_rooms")
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
    action: "create_ppr_room",
    entityType: "ppr_room",
    entityId: data.id,
    meta: {
      object_id: payload.objectId,
      floor: payload.floor?.trim() || null,
    },
  });

  revalidatePath("/ppr/rooms");
}

export async function updatePprRoomAction(formData: FormData) {
  const { profile, supabase, managedObjectIds } = await requireStructureManager();
  const roomId = String(formData.get("room_id") ?? "");
  const payload = pprRoomFormSchema.parse({
    objectId: String(formData.get("object_id") ?? ""),
    name: String(formData.get("name") ?? ""),
    floor: String(formData.get("floor") ?? "") || null,
    description: String(formData.get("description") ?? "") || null,
    isActive: formData.get("is_active") === "on",
  });

  assertObjectAllowed(profile.role, managedObjectIds, payload.objectId);
  if (!canManagePprStructure({ id: profile.id, role: profile.role, accessibleObjectIds: managedObjectIds }, payload.objectId)) {
    throw new Error("Нет прав на изменение помещения ППР");
  }

  const { error } = await supabase
    .from("ppr_rooms")
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
    action: "update_ppr_room",
    entityType: "ppr_room",
    entityId: roomId,
    meta: {
      object_id: payload.objectId,
      floor: payload.floor?.trim() || null,
    },
  });

  revalidatePath("/ppr/rooms");
}

export async function createPprEquipmentAction(formData: FormData) {
  const { profile, supabase, managedObjectIds } = await requireStructureManager();
  const payload = pprEquipmentFormSchema.parse({
    objectId: String(formData.get("object_id") ?? ""),
    systemId: String(formData.get("system_id") ?? ""),
    subsystemId: String(formData.get("subsystem_id") ?? ""),
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
  await assertSubsystemBelongsToSystemAndObject(supabase, payload.subsystemId, payload.systemId, payload.objectId);
  await assertRoomBelongsToObject(supabase, payload.roomId, payload.objectId);

  const { data, error } = await supabase
    .from("ppr_equipment")
    .insert({
      object_id: payload.objectId,
      system_id: payload.systemId,
      subsystem_id: payload.subsystemId,
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
      subsystem_id: payload.subsystemId,
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
    subsystemId: String(formData.get("subsystem_id") ?? ""),
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
  await assertSubsystemBelongsToSystemAndObject(supabase, payload.subsystemId, payload.systemId, payload.objectId);
  await assertRoomBelongsToObject(supabase, payload.roomId, payload.objectId);

  const { error } = await supabase
    .from("ppr_equipment")
    .update({
      object_id: payload.objectId,
      system_id: payload.systemId,
      subsystem_id: payload.subsystemId,
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
      subsystem_id: payload.subsystemId,
      room_id: payload.roomId,
      inventory_no: payload.inventoryNo.trim(),
      status: payload.status,
    },
  });

  revalidatePath("/ppr/equipment");
  revalidatePath(`/ppr/equipment/${equipmentId}`);
}
