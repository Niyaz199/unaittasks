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
import { purchaseRequestFormSchema, purchaseRequestStatusFormSchema } from "@/lib/purchase-requests/validators";
import { writeAudit } from "@/lib/audit";
import { sendPushToUser } from "@/lib/push";

function canUseAllObjects(role: string) {
  return role === "admin" || role === "chief" || role === "lead";
}

function revalidatePurchaseRequestPaths() {
  revalidatePath("/purchase-requests");
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
  if (payload.stockItemId) {
    const { data: stockItem, error: stockItemError } = await supabase
      .from("stock_items")
      .select("object_id,name,unit")
      .eq("id", payload.stockItemId)
      .single();
    if (stockItemError) throw stockItemError;
    if (stockItem.object_id !== payload.objectId) {
      throw new Error("Выбранная ТМЦ не принадлежит объекту заявки");
    }
    itemTitle = stockItem.name;
    itemUnit = stockItem.unit;
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
    .select("object_id,status")
    .eq("id", payload.requestId)
    .single();
  if (requestError) throw requestError;

  assertObjectAllowed(
    profile.role,
    manageableObjects.map((item) => item.id),
    request.object_id,
    "Объект недоступен для управления заявкой"
  );

  const { error } = await supabase
    .from("purchase_requests")
    .update({ status: payload.status })
    .eq("id", payload.requestId);
  if (error) throw error;

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
