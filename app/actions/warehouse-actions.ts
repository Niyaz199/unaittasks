"use server";

import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth";
import {
  canAccessWarehouseModule,
  canManageWarehouseCatalog,
} from "@/lib/capabilities";
import { listWarehouseManageableObjectsForProfile } from "@/lib/warehouse/queries";
import {
  equipmentComponentFormSchema,
  stockItemFormSchema,
  stockLocationFormSchema,
  stockMovementFormSchema,
} from "@/lib/warehouse/validators";
import { sendPushToUser } from "@/lib/push";
import { writeAudit } from "@/lib/audit";

function canUseAllObjects(role: string) {
  return role === "admin" || role === "chief" || role === "lead";
}

function revalidateWarehousePaths(locationId?: string, equipmentId?: string) {
  revalidatePath("/warehouse/items");
  revalidatePath("/warehouse/locations");
  revalidatePath("/purchase-requests");
  if (locationId) {
    revalidatePath(`/warehouse/locations/${locationId}`);
  }
  if (equipmentId) {
    revalidatePath(`/ppr/equipment/${equipmentId}`);
  }
}

async function requireWarehouseManager() {
  const { profile, supabase } = await requireProfile();
  if (!canManageWarehouseCatalog(profile.role)) {
    throw new Error("Нет доступа к управлению складом");
  }

  const objects = await listWarehouseManageableObjectsForProfile(supabase, profile);
  return { profile, supabase, managedObjectIds: objects.map((item) => item.id) };
}

async function requireWarehouseUser() {
  const { profile, supabase } = await requireProfile();
  if (!canAccessWarehouseModule(profile.role)) {
    throw new Error("Нет доступа к складу");
  }

  return { profile, supabase };
}

function assertObjectAllowed(role: string, objectIds: string[], objectId: string, errorMessage: string) {
  if (canUseAllObjects(role)) return;
  if (!objectIds.includes(objectId)) {
    throw new Error(errorMessage);
  }
}

async function replaceStockItemSystemGroups(
  supabase: Awaited<ReturnType<typeof requireProfile>>["supabase"],
  itemId: string,
  objectId: string,
  systemGroupIds: string[]
) {
  const uniqueIds = [...new Set(systemGroupIds)];

  const { error: deleteError } = await supabase.from("stock_item_system_groups").delete().eq("stock_item_id", itemId);
  if (deleteError) throw deleteError;

  if (!uniqueIds.length) return;

  const { error: insertError } = await supabase.from("stock_item_system_groups").insert(
    uniqueIds.map((systemGroupId) => ({
      object_id: objectId,
      stock_item_id: itemId,
      system_group_id: systemGroupId,
    }))
  );
  if (insertError) throw insertError;
}

async function getStockItemObjectId(
  supabase: Awaited<ReturnType<typeof requireProfile>>["supabase"],
  itemId: string
) {
  const { data, error } = await supabase.from("stock_items").select("object_id").eq("id", itemId).single();
  if (error) throw error;
  return data.object_id as string;
}

async function getEquipmentObjectId(
  supabase: Awaited<ReturnType<typeof requireProfile>>["supabase"],
  equipmentId: string
) {
  const { data, error } = await supabase.from("ppr_equipment").select("object_id").eq("id", equipmentId).single();
  if (error) throw error;
  return data.object_id as string;
}

async function getLocationObjectId(
  supabase: Awaited<ReturnType<typeof requireProfile>>["supabase"],
  locationId: string
) {
  const { data, error } = await supabase.from("stock_locations").select("object_id").eq("id", locationId).single();
  if (error) throw error;
  return data.object_id as string;
}

export async function createStockItemAction(formData: FormData) {
  const { profile, supabase, managedObjectIds } = await requireWarehouseManager();
  const initialQtyRaw = formData.get("initial_qty");
  const payload = stockItemFormSchema.parse({
    objectId: String(formData.get("object_id") ?? ""),
    name: String(formData.get("name") ?? ""),
    kind: String(formData.get("kind") ?? "material"),
    unit: String(formData.get("unit") ?? "шт"),
    sku: String(formData.get("sku") ?? "") || null,
    minQty: String(formData.get("min_qty") ?? "0"),
    storageLocationId: String(formData.get("storage_location_id") ?? ""),
    systemGroupIds: formData
      .getAll("system_group_ids")
      .map((value) => String(value))
      .filter(Boolean),
    initialQty: initialQtyRaw === null || String(initialQtyRaw).trim() === "" ? null : String(initialQtyRaw),
    comment: String(formData.get("comment") ?? "") || null,
    isActive: formData.get("is_active") === "on",
  });

  assertObjectAllowed(profile.role, managedObjectIds, payload.objectId, "Объект недоступен для управления ТМЦ");
  const locationObjectId = await getLocationObjectId(supabase, payload.storageLocationId);
  if (locationObjectId !== payload.objectId) {
    throw new Error("Место хранения должно принадлежать выбранному объекту");
  }

  const { data, error } = await supabase
    .from("stock_items")
    .insert({
      object_id: payload.objectId,
      name: payload.name.trim(),
      kind: payload.kind,
      unit: payload.unit.trim(),
      sku: payload.sku?.trim() || null,
      min_qty: payload.minQty,
      storage_location_id: payload.storageLocationId,
      comment: payload.comment?.trim() || null,
      is_active: payload.isActive,
    })
    .select("id")
    .single();
  if (error) throw error;

  await replaceStockItemSystemGroups(supabase, data.id, payload.objectId, payload.systemGroupIds);

  if (payload.initialQty && payload.initialQty > 0) {
    const { data: movement, error: movementError } = await supabase
      .from("stock_movements")
      .insert({
        object_id: payload.objectId,
        item_id: data.id,
        location_id: payload.storageLocationId,
        movement_type: "receipt",
        quantity: payload.initialQty,
        note: "Первичное оприходование при создании карточки ТМЦ",
        actor_id: profile.id,
      })
      .select("id")
      .single();
    if (movementError) throw movementError;

    await writeAudit({
      actorId: profile.id,
      action: "create_stock_movement",
      entityType: "stock_movement",
      entityId: movement.id,
      meta: {
        object_id: payload.objectId,
        item_id: data.id,
        location_id: payload.storageLocationId,
        movement_type: "receipt",
        quantity: payload.initialQty,
        source: "stock_item_create",
      },
      supabase,
    });
  }

  await writeAudit({
    actorId: profile.id,
    action: "create_stock_item",
    entityType: "stock_item",
    entityId: data.id,
    meta: {
      object_id: payload.objectId,
      kind: payload.kind,
      unit: payload.unit.trim(),
      min_qty: payload.minQty,
      storage_location_id: payload.storageLocationId,
      system_group_ids: payload.systemGroupIds,
      initial_qty: payload.initialQty,
    },
    supabase,
  });

  revalidateWarehousePaths(payload.storageLocationId);
  return { id: data.id };
}

export async function updateStockItemAction(formData: FormData) {
  const { profile, supabase, managedObjectIds } = await requireWarehouseManager();
  const itemId = String(formData.get("item_id") ?? "");
  const payload = stockItemFormSchema.parse({
    objectId: String(formData.get("object_id") ?? ""),
    name: String(formData.get("name") ?? ""),
    kind: String(formData.get("kind") ?? "material"),
    unit: String(formData.get("unit") ?? "шт"),
    sku: String(formData.get("sku") ?? "") || null,
    minQty: String(formData.get("min_qty") ?? "0"),
    storageLocationId: String(formData.get("storage_location_id") ?? ""),
    systemGroupIds: formData
      .getAll("system_group_ids")
      .map((value) => String(value))
      .filter(Boolean),
    initialQty: null,
    comment: String(formData.get("comment") ?? "") || null,
    isActive: formData.get("is_active") === "on",
  });

  assertObjectAllowed(profile.role, managedObjectIds, payload.objectId, "Объект недоступен для управления ТМЦ");
  const locationObjectId = await getLocationObjectId(supabase, payload.storageLocationId);
  if (locationObjectId !== payload.objectId) {
    throw new Error("Место хранения должно принадлежать выбранному объекту");
  }

  const { error } = await supabase
    .from("stock_items")
    .update({
      object_id: payload.objectId,
      name: payload.name.trim(),
      kind: payload.kind,
      unit: payload.unit.trim(),
      sku: payload.sku?.trim() || null,
      min_qty: payload.minQty,
      storage_location_id: payload.storageLocationId,
      comment: payload.comment?.trim() || null,
      is_active: payload.isActive,
    })
    .eq("id", itemId);
  if (error) throw error;

  await replaceStockItemSystemGroups(supabase, itemId, payload.objectId, payload.systemGroupIds);

  await writeAudit({
    actorId: profile.id,
    action: "update_stock_item",
    entityType: "stock_item",
    entityId: itemId,
    meta: {
      object_id: payload.objectId,
      kind: payload.kind,
      unit: payload.unit.trim(),
      min_qty: payload.minQty,
      storage_location_id: payload.storageLocationId,
      system_group_ids: payload.systemGroupIds,
      is_active: payload.isActive,
    },
    supabase,
  });

  revalidateWarehousePaths(payload.storageLocationId);
  return { id: itemId };
}

export async function createStockLocationAction(formData: FormData) {
  const { profile, supabase, managedObjectIds } = await requireWarehouseManager();
  const payload = stockLocationFormSchema.parse({
    objectId: String(formData.get("object_id") ?? ""),
    name: String(formData.get("name") ?? ""),
    description: String(formData.get("description") ?? "") || null,
    isActive: formData.get("is_active") === "on",
  });

  assertObjectAllowed(profile.role, managedObjectIds, payload.objectId, "Объект недоступен для управления местами хранения");

  const { data, error } = await supabase
    .from("stock_locations")
    .insert({
      object_id: payload.objectId,
      name: payload.name.trim(),
      description: payload.description?.trim() || null,
      is_active: payload.isActive,
    })
    .select("id")
    .single();
  if (error) throw error;

  await writeAudit({
    actorId: profile.id,
    action: "create_stock_location",
    entityType: "stock_location",
    entityId: data.id,
    meta: {
      object_id: payload.objectId,
      is_active: payload.isActive,
    },
    supabase,
  });

  revalidateWarehousePaths(data.id);
}

export async function updateStockLocationAction(formData: FormData) {
  const { profile, supabase, managedObjectIds } = await requireWarehouseManager();
  const locationId = String(formData.get("location_id") ?? "");
  const payload = stockLocationFormSchema.parse({
    objectId: String(formData.get("object_id") ?? ""),
    name: String(formData.get("name") ?? ""),
    description: String(formData.get("description") ?? "") || null,
    isActive: formData.get("is_active") === "on",
  });

  assertObjectAllowed(profile.role, managedObjectIds, payload.objectId, "Объект недоступен для управления местами хранения");

  const { error } = await supabase
    .from("stock_locations")
    .update({
      object_id: payload.objectId,
      name: payload.name.trim(),
      description: payload.description?.trim() || null,
      is_active: payload.isActive,
    })
    .eq("id", locationId);
  if (error) throw error;

  await writeAudit({
    actorId: profile.id,
    action: "update_stock_location",
    entityType: "stock_location",
    entityId: locationId,
    meta: {
      object_id: payload.objectId,
      is_active: payload.isActive,
    },
    supabase,
  });

  revalidateWarehousePaths(locationId);
}

export async function recordStockMovementAction(formData: FormData) {
  const { profile, supabase } = await requireWarehouseUser();
  const payload = stockMovementFormSchema.parse({
    objectId: String(formData.get("object_id") ?? ""),
    itemId: String(formData.get("item_id") ?? ""),
    locationId: String(formData.get("location_id") ?? ""),
    movementType: String(formData.get("movement_type") ?? "issue"),
    quantity: String(formData.get("quantity") ?? "0"),
    note: String(formData.get("note") ?? "") || null,
  });

  const [itemObjectId, locationObjectId] = await Promise.all([
    getStockItemObjectId(supabase, payload.itemId),
    getLocationObjectId(supabase, payload.locationId),
  ]);
  if (itemObjectId !== payload.objectId || locationObjectId !== payload.objectId) {
    throw new Error("ТМЦ и место хранения должны принадлежать выбранному объекту");
  }

  const { data, error } = await supabase
    .from("stock_movements")
    .insert({
      object_id: payload.objectId,
      item_id: payload.itemId,
      location_id: payload.locationId,
      movement_type: payload.movementType,
      quantity: payload.quantity,
      note: payload.note?.trim() || null,
      actor_id: profile.id,
    })
    .select("id")
    .single();
  if (error) throw error;

  const { data: lowStockData, error: lowStockError } = await supabase.rpc("stock_check_low_stock", {
    _item_id: payload.itemId,
    _actor_id: profile.id,
  });
  if (lowStockError) throw lowStockError;

  const lowStockRow = Array.isArray(lowStockData) ? lowStockData[0] ?? null : lowStockData ?? null;
  if (lowStockRow?.assigned_to) {
    await sendPushToUser(String(lowStockRow.assigned_to), {
      title: "Критический остаток на складе",
      body: `${String(lowStockRow.item_name)} требует закупки`,
      url: `/purchase-requests?objectId=${encodeURIComponent(String(lowStockRow.object_id))}`,
    });
  }

  await writeAudit({
    actorId: profile.id,
    action: "create_stock_movement",
    entityType: "stock_movement",
    entityId: data.id,
    meta: {
      object_id: payload.objectId,
      item_id: payload.itemId,
      location_id: payload.locationId,
      movement_type: payload.movementType,
      quantity: payload.quantity,
    },
    supabase,
  });

  revalidateWarehousePaths(payload.locationId);
}

export async function upsertEquipmentComponentAction(formData: FormData) {
  const { profile, supabase, managedObjectIds } = await requireWarehouseManager();
  const componentId = String(formData.get("component_id") ?? "");
  const payload = equipmentComponentFormSchema.parse({
    equipmentId: String(formData.get("equipment_id") ?? ""),
    stockItemId: String(formData.get("stock_item_id") ?? ""),
    quantity: String(formData.get("quantity") ?? "1"),
    reserveQty: String(formData.get("reserve_qty") ?? "0"),
    isCritical: formData.get("is_critical") === "on",
    note: String(formData.get("note") ?? "") || null,
  });

  const [equipmentObjectId, itemObjectId] = await Promise.all([
    getEquipmentObjectId(supabase, payload.equipmentId),
    getStockItemObjectId(supabase, payload.stockItemId),
  ]);
  if (equipmentObjectId !== itemObjectId) {
    throw new Error("Оборудование и ТМЦ должны принадлежать одному объекту");
  }

  assertObjectAllowed(profile.role, managedObjectIds, equipmentObjectId, "Объект недоступен для изменения состава оборудования");

  if (componentId) {
    const { error } = await supabase
      .from("ppr_equipment_components")
      .update({
        object_id: equipmentObjectId,
        stock_item_id: payload.stockItemId,
        quantity: payload.quantity,
        reserve_qty: payload.reserveQty,
        is_critical: payload.isCritical,
        note: payload.note?.trim() || null,
      })
      .eq("id", componentId);
    if (error) throw error;

    await writeAudit({
      actorId: profile.id,
      action: "update_equipment_component",
      entityType: "equipment_component",
      entityId: componentId,
      meta: {
        object_id: equipmentObjectId,
        equipment_id: payload.equipmentId,
        stock_item_id: payload.stockItemId,
        is_critical: payload.isCritical,
      },
      supabase,
    });
  } else {
    const { data, error } = await supabase
      .from("ppr_equipment_components")
      .insert({
        object_id: equipmentObjectId,
        equipment_id: payload.equipmentId,
        stock_item_id: payload.stockItemId,
        quantity: payload.quantity,
        reserve_qty: payload.reserveQty,
        is_critical: payload.isCritical,
        note: payload.note?.trim() || null,
      })
      .select("id")
      .single();
    if (error) throw error;

    await writeAudit({
      actorId: profile.id,
      action: "create_equipment_component",
      entityType: "equipment_component",
      entityId: data.id,
      meta: {
        object_id: equipmentObjectId,
        equipment_id: payload.equipmentId,
        stock_item_id: payload.stockItemId,
        is_critical: payload.isCritical,
      },
      supabase,
    });
  }

  revalidateWarehousePaths(undefined, payload.equipmentId);
}

export async function removeEquipmentComponentAction(formData: FormData) {
  const { profile, supabase, managedObjectIds } = await requireWarehouseManager();
  const componentId = String(formData.get("component_id") ?? "");
  const equipmentId = String(formData.get("equipment_id") ?? "");
  const equipmentObjectId = await getEquipmentObjectId(supabase, equipmentId);
  assertObjectAllowed(profile.role, managedObjectIds, equipmentObjectId, "Объект недоступен для изменения состава оборудования");

  const { error } = await supabase.from("ppr_equipment_components").delete().eq("id", componentId);
  if (error) throw error;

  await writeAudit({
    actorId: profile.id,
    action: "delete_equipment_component",
    entityType: "equipment_component",
    entityId: componentId,
    meta: {
      object_id: equipmentObjectId,
      equipment_id: equipmentId,
    },
    supabase,
  });

  revalidateWarehousePaths(undefined, equipmentId);
}
