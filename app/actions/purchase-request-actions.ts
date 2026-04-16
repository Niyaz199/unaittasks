"use server";

import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth";
import {
  canCreatePurchaseRequests,
  canManagePurchaseRequests,
} from "@/lib/capabilities";
import {
  listManageablePurchaseRequestObjectsForProfile,
  listPurchaseRequestCreatableObjectsForProfile,
} from "@/lib/purchase-requests/queries";
import {
  purchaseRequestCartToggleSchema,
  purchaseRequestFinalizeDraftSchema,
  purchaseRequestFormSchema,
  purchaseRequestReassignItemSchema,
  purchaseRequestStatusFormSchema,
} from "@/lib/purchase-requests/validators";
import { writeAudit } from "@/lib/audit";
import { sendPushToUser } from "@/lib/push";

function canUseAllObjects(role: string) {
  return role === "admin" || role === "chief" || role === "lead" || role === "procurement_manager";
}

function revalidatePurchaseRequestPaths() {
  revalidatePath("/purchase-requests");
}

async function notifyRequestAssignee(
  assigneeId: string | null | undefined,
  title: string,
  body: string,
  objectId: string,
  actorId?: string
) {
  if (!assigneeId || assigneeId === actorId) return;
  await sendPushToUser(assigneeId, {
    title,
    body,
    url: `/purchase-requests?objectId=${encodeURIComponent(objectId)}`,
  });
}

function assertObjectAllowed(role: string, objectIds: string[], objectId: string, errorMessage: string) {
  if (canUseAllObjects(role)) return;
  if (!objectIds.includes(objectId)) {
    throw new Error(errorMessage);
  }
}

export async function createPurchaseRequestAction(formData: FormData) {
  const { profile, supabase } = await requireProfile();
  if (!canCreatePurchaseRequests(profile.role)) {
    throw new Error("Нет доступа к созданию заявок на закупку");
  }

  const objects = await listPurchaseRequestCreatableObjectsForProfile(supabase, profile);
  const payload = purchaseRequestFormSchema.parse({
    objectId: String(formData.get("object_id") ?? ""),
    stockItemId: String(formData.get("stock_item_id") ?? "") || null,
    title: String(formData.get("title") ?? ""),
    unit: String(formData.get("unit") ?? "шт"),
    quantityRequested: String(formData.get("quantity_requested") ?? "1"),
    note: String(formData.get("note") ?? "") || null,
    description: String(formData.get("description") ?? "") || null,
  });

  assertObjectAllowed(profile.role, objects.map((item) => item.id), payload.objectId, "Объект недоступен для создания заявки");

  let itemTitle = payload.title.trim();
  let itemUnit = payload.unit.trim();
  let itemStorageLocationId: string | null = null;
  let itemLocationNameSnapshot: string | null = null;
  if (payload.stockItemId) {
    const { data: stockItem, error: stockItemError } = await supabase
      .from("stock_items")
      .select("object_id,name,unit,storage_location_id,storage_location:stock_locations(name)")
      .eq("id", payload.stockItemId)
      .single();
    if (stockItemError) throw stockItemError;
    if (stockItem.object_id !== payload.objectId) {
      throw new Error("Выбранная ТМЦ не принадлежит объекту заявки");
    }
    itemTitle = stockItem.name;
    itemUnit = stockItem.unit;
    itemStorageLocationId = stockItem.storage_location_id ?? null;
    const stockItemLocation = Array.isArray(stockItem.storage_location) ? stockItem.storage_location[0] ?? null : stockItem.storage_location;
    itemLocationNameSnapshot = stockItemLocation?.name ?? null;
  }

  const { data: objectRow, error: objectError } = await supabase
    .from("objects")
    .select("object_engineer_id")
    .eq("id", payload.objectId)
    .single();
  if (objectError) throw objectError;

  const { data: request, error: requestError } = await supabase
    .from("purchase_requests")
    .insert({
      object_id: payload.objectId,
      status: "new",
      source: "manual",
      request_kind: "final",
      executor_role: "engineer",
      description: payload.description?.trim() || null,
      requested_by: profile.id,
      assigned_to: objectRow.object_engineer_id ?? null,
    })
    .select("id")
    .single();
  if (requestError) throw requestError;

  const { data: item, error: itemError } = await supabase
    .from("purchase_request_items")
    .insert({
      request_id: request.id,
      object_id: payload.objectId,
      stock_item_id: payload.stockItemId ?? null,
      title: itemTitle,
      unit: itemUnit,
      quantity_requested: payload.quantityRequested,
      note: payload.note?.trim() || null,
      is_auto_generated: false,
      assigned_role: "engineer",
      storage_location_id: itemStorageLocationId,
      location_name_snapshot: itemLocationNameSnapshot,
    })
    .select("id")
    .single();
  if (itemError) throw itemError;

  await writeAudit({
    actorId: profile.id,
    action: "create_purchase_request",
    entityType: "purchase_request",
    entityId: request.id,
    meta: {
      object_id: payload.objectId,
      item_id: item.id,
      stock_item_id: payload.stockItemId ?? null,
      assigned_to: objectRow.object_engineer_id ?? null,
      quantity_requested: payload.quantityRequested,
    },
    supabase,
  });

  if (objectRow.object_engineer_id) {
    await sendPushToUser(objectRow.object_engineer_id, {
      title: "Новая заявка на закупку",
      body: itemTitle,
      url: `/purchase-requests?objectId=${encodeURIComponent(payload.objectId)}`,
    });
  }

  revalidatePurchaseRequestPaths();
}

export async function updatePurchaseRequestStatusAction(formData: FormData) {
  const { profile, supabase } = await requireProfile();
  if (!canManagePurchaseRequests(profile.role)) {
    throw new Error("Нет доступа к управлению заявками на закупку");
  }

  const manageableObjects = await listManageablePurchaseRequestObjectsForProfile(supabase, profile);
  const payload = purchaseRequestStatusFormSchema.parse({
    requestId: String(formData.get("request_id") ?? ""),
    status: String(formData.get("status") ?? "new"),
  });

  const { data: request, error: requestError } = await supabase
    .from("purchase_requests")
    .select("object_id,status,request_kind")
    .eq("id", payload.requestId)
    .single();
  if (requestError) throw requestError;

  if (request.request_kind === "draft") {
    throw new Error("Черновая подборка не меняет статус вручную. Сначала сформируйте итоговые заявки.");
  }

  if (profile.role === "procurement_manager") {
    const { data: ownRequest, error: ownRequestError } = await supabase
      .from("purchase_requests")
      .select("assigned_to,executor_role")
      .eq("id", payload.requestId)
      .single();
    if (ownRequestError) throw ownRequestError;
    if (ownRequest.executor_role !== "procurement_manager" || ownRequest.assigned_to !== profile.id) {
      throw new Error("Менеджер по закупкам может менять только свою итоговую заявку.");
    }
  }

  assertObjectAllowed(
    profile.role,
    manageableObjects.map((item) => item.id),
    request.object_id,
    "Объект недоступен для управления заявкой"
  );

  if (payload.status === "fulfilled") {
    const { error } = await supabase.rpc("purchase_request_mark_fulfilled_and_receive", {
      _request_id: payload.requestId,
      _actor_id: profile.id,
    });
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from("purchase_requests")
      .update({ status: payload.status })
      .eq("id", payload.requestId);
    if (error) throw error;
  }

  await writeAudit({
    actorId: profile.id,
    action: "update_purchase_request",
    entityType: "purchase_request",
    entityId: payload.requestId,
    meta: {
      object_id: request.object_id,
      from: request.status,
      to: payload.status,
    },
    supabase,
  });

  revalidatePurchaseRequestPaths();
}

export async function finalizePurchaseDraftAction(formData: FormData) {
  const { profile, supabase } = await requireProfile();
  if (!canManagePurchaseRequests(profile.role)) {
    throw new Error("Нет доступа к обработке черновой подборки");
  }

  if (profile.role === "procurement_manager") {
    throw new Error("Черновик подтверждает инженер объекта.");
  }

  const manageableObjects = await listManageablePurchaseRequestObjectsForProfile(supabase, profile);
  const payload = purchaseRequestFinalizeDraftSchema.parse({
    requestId: String(formData.get("request_id") ?? ""),
  });

  const { data: request, error: requestError } = await supabase
    .from("purchase_requests")
    .select("id,object_id,request_kind")
    .eq("id", payload.requestId)
    .single();
  if (requestError) throw requestError;

  assertObjectAllowed(
    profile.role,
    manageableObjects.map((item) => item.id),
    request.object_id,
    "Объект недоступен для обработки черновой подборки"
  );

  if (request.request_kind !== "draft") {
    throw new Error("Выбранная заявка не является черновиком");
  }

  const { data, error } = await supabase.rpc("purchase_request_finalize_draft", {
    _request_id: payload.requestId,
    _actor_id: profile.id,
  });
  if (error) throw error;

  const row = Array.isArray(data) ? data[0] ?? null : data ?? null;

  if (row?.engineer_request_id) {
    const { data: engineerRequest, error: engineerRequestError } = await supabase
      .from("purchase_requests")
      .select("assigned_to,object_id")
      .eq("id", row.engineer_request_id)
      .single();
    if (engineerRequestError) throw engineerRequestError;

    await notifyRequestAssignee(
      engineerRequest.assigned_to,
      "Новая заявка на закупку",
      "Вам назначена итоговая заявка инженера объекта",
      engineerRequest.object_id,
      profile.id
    );
  }

  if (row?.procurement_request_id) {
    const { data: procurementRequest, error: procurementRequestError } = await supabase
      .from("purchase_requests")
      .select("assigned_to,object_id")
      .eq("id", row.procurement_request_id)
      .single();
    if (procurementRequestError) throw procurementRequestError;

    await notifyRequestAssignee(
      procurementRequest.assigned_to,
      "Новая заявка на закупку",
      "Вам назначена итоговая заявка менеджера по закупкам",
      procurementRequest.object_id,
      profile.id
    );
  }

  await writeAudit({
    actorId: profile.id,
    action: "update_purchase_request",
    entityType: "purchase_request",
    entityId: payload.requestId,
    meta: {
      operation: "finalize_draft",
      object_id: request.object_id,
      engineer_request_id: row?.engineer_request_id ?? null,
      procurement_request_id: row?.procurement_request_id ?? null,
    },
    supabase,
  });

  revalidatePurchaseRequestPaths();
  return row;
}

export async function reassignPurchaseRequestItemAction(formData: FormData) {
  const { profile, supabase } = await requireProfile();
  if (!canManagePurchaseRequests(profile.role)) {
    throw new Error("Нет доступа к перераспределению позиции");
  }

  if (profile.role === "procurement_manager") {
    throw new Error("Перераспределять позиции может инженер объекта.");
  }

  const payload = purchaseRequestReassignItemSchema.parse({
    itemId: String(formData.get("item_id") ?? ""),
    targetRole: String(formData.get("target_role") ?? ""),
  });

  const { data, error } = await supabase.rpc("purchase_request_reassign_item", {
    _item_id: payload.itemId,
    _target_role: payload.targetRole,
    _actor_id: profile.id,
  });
  if (error) throw error;

  const row = Array.isArray(data) ? data[0] ?? null : data ?? null;

  if (row?.target_request_id) {
    const { data: targetRequest, error: targetRequestError } = await supabase
      .from("purchase_requests")
      .select("assigned_to,object_id,executor_role")
      .eq("id", row.target_request_id)
      .single();
    if (targetRequestError) throw targetRequestError;

    await notifyRequestAssignee(
      targetRequest.assigned_to,
      "Заявка на закупку обновлена",
      targetRequest.executor_role === "procurement_manager"
        ? "Вам передана позиция в итоговую заявку менеджера по закупкам"
        : "Вам передана позиция в итоговую заявку инженера объекта",
      targetRequest.object_id,
      profile.id
    );
  }

  await writeAudit({
    actorId: profile.id,
    action: "update_purchase_request",
    entityType: "purchase_request",
    entityId: payload.itemId,
    meta: {
      operation: "reassign_item",
      target_role: payload.targetRole,
      source_request_id: row?.source_request_id ?? null,
      target_request_id: row?.target_request_id ?? null,
    },
    supabase,
  });

  revalidatePurchaseRequestPaths();
  return row;
}

export async function togglePurchaseRequestItemCartAction(formData: FormData) {
  const { profile, supabase } = await requireProfile();
  if (!canManagePurchaseRequests(profile.role)) {
    throw new Error("Нет доступа к отметке позиции");
  }

  const payload = purchaseRequestCartToggleSchema.parse({
    itemId: String(formData.get("item_id") ?? ""),
    inCart: String(formData.get("in_cart") ?? "") === "true",
  });

  if (profile.role === "procurement_manager") {
    const { data: itemRequest, error: itemRequestError } = await supabase
      .from("purchase_request_items")
      .select("request:purchase_requests!purchase_request_items_request_id_fkey(assigned_to,executor_role,request_kind)")
      .eq("id", payload.itemId)
      .single();
    if (itemRequestError) throw itemRequestError;
    const request = Array.isArray(itemRequest.request) ? itemRequest.request[0] ?? null : itemRequest.request;
    if (!request || request.request_kind !== "final" || request.executor_role !== "procurement_manager" || request.assigned_to !== profile.id) {
      throw new Error("Менеджер по закупкам может отмечать корзину только в своей итоговой заявке.");
    }
  }

  const { error } = await supabase.rpc("purchase_request_toggle_item_cart", {
    _item_id: payload.itemId,
    _in_cart: payload.inCart,
  });
  if (error) throw error;

  await writeAudit({
    actorId: profile.id,
    action: "update_purchase_request",
    entityType: "purchase_request",
    entityId: payload.itemId,
    meta: {
      operation: "toggle_item_cart",
      in_cart: payload.inCart,
    },
    supabase,
  });

  revalidatePurchaseRequestPaths();
}
