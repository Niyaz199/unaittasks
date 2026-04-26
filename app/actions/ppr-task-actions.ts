"use server";

import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { writeAudit } from "@/lib/audit";
import { getPprTaskByIdForProfile } from "@/lib/ppr/queries";
import {
  buildPprTaskActor,
  canClosePprTaskLifecycle,
  canPausePprTaskLifecycle,
  canResumePprTaskLifecycle,
  syncPprTaskPlanItemsStatus,
} from "@/lib/ppr/task-lifecycle";
import { pprTaskCloseWriteoffSchema } from "@/lib/warehouse/validators";

function revalidateTaskPaths(taskId: string) {
  revalidatePath("/ppr/my");
  revalidatePath("/ppr/tasks");
  revalidatePath("/ppr/archive");
  revalidatePath("/ppr/calendar");
  revalidatePath(`/ppr/tasks/${taskId}`);
}

export type PprTaskCloseWriteoffShortage = {
  stockItemId: string;
  name: string;
  requested: number;
  available: number;
  reason: string;
};

export type PprTaskCloseWriteoffResult = {
  writtenOff: { stockItemId: string; quantity: number }[];
  shortages: PprTaskCloseWriteoffShortage[];
};

export async function closePprTaskWithWriteoffAction(
  formData: FormData
): Promise<PprTaskCloseWriteoffResult> {
  const taskId = String(formData.get("task_id") ?? "");
  const skip = String(formData.get("skip") ?? "") === "1";
  const itemsRaw = String(formData.get("items") ?? "[]");

  let itemsParsed: unknown = [];
  try {
    itemsParsed = JSON.parse(itemsRaw);
  } catch {
    throw new Error("Некорректный список позиций к списанию");
  }

  const payload = pprTaskCloseWriteoffSchema.parse({
    taskId,
    skip,
    items: itemsParsed,
  });

  const { profile } = await requireProfile();
  const supabase = await createSupabaseServerClient();

  const task = await getPprTaskByIdForProfile(supabase, profile, payload.taskId);
  if (!task) {
    throw new Error("ППР-заявка не найдена");
  }

  const actor = await buildPprTaskActor(supabase, profile);
  if (!canClosePprTaskLifecycle(actor, task)) {
    throw new Error("Нет прав на закрытие ППР-заявки");
  }

  // Сначала атомарно закрываем задачу — чтобы при гонке (concurrent cancel/close)
  // движения по списанию не оказались записаны на задачу, которая так и не закрылась.
  const { data: closedRow, error: closeError } = await supabase
    .from("ppr_tasks")
    .update({ status: "closed" })
    .eq("id", payload.taskId)
    .eq("status", "done")
    .select("id")
    .maybeSingle();
  if (closeError) throw closeError;
  if (!closedRow) {
    throw new Error("ППР-заявка больше не находится в статусе `done`");
  }

  const writtenOff: { stockItemId: string; quantity: number }[] = [];
  const shortages: PprTaskCloseWriteoffShortage[] = [];

  if (!payload.skip && payload.items.length > 0) {
    const stockItemIds = Array.from(new Set(payload.items.map((i) => i.stockItemId)));

    const { data: stockItemsData, error: stockItemsError } = await supabase
      .from("stock_items")
      .select("id,object_id,name,unit,storage_location_id")
      .in("id", stockItemIds);
    if (stockItemsError) throw stockItemsError;
    const stockItemsById = new Map(
      (stockItemsData ?? []).map((row) => [row.id as string, row])
    );

    const locationIds = Array.from(
      new Set(
        (stockItemsData ?? [])
          .map((r) => r.storage_location_id as string | null)
          .filter((v): v is string => Boolean(v))
      )
    );

    const balancesByKey = new Map<string, number>();
    if (locationIds.length > 0) {
      const { data: balancesData, error: balancesError } = await supabase
        .from("stock_balances")
        .select("item_id,location_id,qty")
        .in("item_id", stockItemIds)
        .in("location_id", locationIds);
      if (balancesError) throw balancesError;
      for (const row of balancesData ?? []) {
        balancesByKey.set(`${row.item_id}:${row.location_id}`, Number(row.qty) || 0);
      }
    }

    for (const item of payload.items) {
      const stockItem = stockItemsById.get(item.stockItemId);
      if (!stockItem) {
        shortages.push({
          stockItemId: item.stockItemId,
          name: "(неизвестная позиция)",
          requested: item.quantity,
          available: 0,
          reason: "ТМЦ не найден",
        });
        continue;
      }

      if (stockItem.object_id !== task.object_id) {
        shortages.push({
          stockItemId: item.stockItemId,
          name: stockItem.name,
          requested: item.quantity,
          available: 0,
          reason: "ТМЦ относится к другому объекту",
        });
        continue;
      }

      const locationId = stockItem.storage_location_id;
      if (!locationId) {
        shortages.push({
          stockItemId: item.stockItemId,
          name: stockItem.name,
          requested: item.quantity,
          available: 0,
          reason: "У ТМЦ не задано место хранения",
        });
        continue;
      }

      const available = balancesByKey.get(`${item.stockItemId}:${locationId}`) ?? 0;
      const toWrite = Math.min(item.quantity, available);

      if (toWrite > 0) {
        const { error: movementError } = await supabase.from("stock_movements").insert({
          object_id: task.object_id,
          item_id: item.stockItemId,
          location_id: locationId,
          movement_type: "issue",
          quantity: toWrite,
          note: "Списание при закрытии ППР-задачи",
          actor_id: profile.id,
          source_task_id: payload.taskId,
        });
        if (movementError) throw movementError;
        writtenOff.push({ stockItemId: item.stockItemId, quantity: toWrite });
      }

      if (toWrite < item.quantity) {
        shortages.push({
          stockItemId: item.stockItemId,
          name: stockItem.name,
          requested: item.quantity,
          available,
          reason: available <= 0 ? "Нет остатка на месте хранения" : "Недостаточный остаток",
        });
      }
    }
  }

  await syncPprTaskPlanItemsStatus(supabase, payload.taskId, "closed");

  await writeAudit({
    actorId: profile.id,
    action: "close_ppr_task",
    entityType: "ppr_task",
    entityId: payload.taskId,
    meta: {
      object_id: task.object_id,
      from: task.status,
      to: "closed",
      writeoff_skipped: payload.skip,
      written_off: writtenOff,
      shortages: shortages.map((s) => ({
        stock_item_id: s.stockItemId,
        requested: s.requested,
        available: s.available,
        reason: s.reason,
      })),
    },
  });

  revalidateTaskPaths(payload.taskId);

  return { writtenOff, shortages };
}

export async function closePprTaskAction(formData: FormData) {
  const taskId = String(formData.get("task_id") ?? "");
  const { profile } = await requireProfile();
  const supabase = await createSupabaseServerClient();

  const task = await getPprTaskByIdForProfile(supabase, profile, taskId);
  if (!task) {
    throw new Error("ППР-заявка не найдена");
  }

  const actor = await buildPprTaskActor(supabase, profile);
  if (!canClosePprTaskLifecycle(actor, task)) {
    throw new Error("Нет прав на закрытие ППР-заявки");
  }

  const { data, error } = await supabase
    .from("ppr_tasks")
    .update({ status: "closed" })
    .eq("id", taskId)
    .eq("status", "done")
    .select("id")
    .maybeSingle();
  if (error) throw error;
  if (!data) {
    throw new Error("ППР-заявка больше не находится в статусе `done`");
  }

  await syncPprTaskPlanItemsStatus(supabase, taskId, "closed");

  await writeAudit({
    actorId: profile.id,
    action: "close_ppr_task",
    entityType: "ppr_task",
    entityId: taskId,
    meta: {
      object_id: task.object_id,
      from: task.status,
      to: "closed",
    },
  });

  revalidateTaskPaths(taskId);
}

export async function pausePprTaskAction(formData: FormData) {
  const taskId = String(formData.get("task_id") ?? "");
  const reasonRaw = String(formData.get("reason") ?? "").trim();
  const purchaseRequestIdRaw = String(formData.get("purchase_request_id") ?? "").trim();

  if (!reasonRaw) {
    throw new Error("Укажите причину паузы ППР-заявки");
  }
  if (reasonRaw.length > 2000) {
    throw new Error("Причина не должна превышать 2000 символов");
  }

  const { profile } = await requireProfile();
  const supabase = await createSupabaseServerClient();

  const task = await getPprTaskByIdForProfile(supabase, profile, taskId);
  if (!task) {
    throw new Error("ППР-заявка не найдена");
  }

  const actor = await buildPprTaskActor(supabase, profile);
  if (!canPausePprTaskLifecycle(actor, task)) {
    throw new Error("Нет прав на постановку ППР-заявки на паузу");
  }

  let purchaseRequestId: string | null = null;
  if (purchaseRequestIdRaw) {
    const { data: prRow, error: prError } = await supabase
      .from("purchase_requests")
      .select("id,object_id,source_task_id")
      .eq("id", purchaseRequestIdRaw)
      .maybeSingle();
    if (prError) throw prError;
    if (!prRow) {
      throw new Error("Связанная заявка на закупку не найдена");
    }
    if (prRow.object_id !== task.object_id) {
      throw new Error("Заявка на закупку относится к другому объекту");
    }
    purchaseRequestId = prRow.id as string;
  }

  const { data, error } = await supabase
    .from("ppr_tasks")
    .update({
      status: "on_hold",
      hold_reason: reasonRaw,
      held_by: profile.id,
      hold_purchase_request_id: purchaseRequestId,
    })
    .eq("id", taskId)
    .eq("status", "in_progress")
    .select("id")
    .maybeSingle();
  if (error) throw error;
  if (!data) {
    throw new Error("ППР-заявка больше не находится в статусе «в работе»");
  }

  await writeAudit({
    actorId: profile.id,
    action: "pause_ppr_task",
    entityType: "ppr_task",
    entityId: taskId,
    meta: {
      object_id: task.object_id,
      from: task.status,
      to: "on_hold",
      reason: reasonRaw,
      purchase_request_id: purchaseRequestId,
    },
  });

  revalidateTaskPaths(taskId);
}

export async function resumePprTaskAction(formData: FormData) {
  const taskId = String(formData.get("task_id") ?? "");
  const { profile } = await requireProfile();
  const supabase = await createSupabaseServerClient();

  const task = await getPprTaskByIdForProfile(supabase, profile, taskId);
  if (!task) {
    throw new Error("ППР-заявка не найдена");
  }

  const actor = await buildPprTaskActor(supabase, profile);
  if (!canResumePprTaskLifecycle(actor, task)) {
    throw new Error("Нет прав на возобновление ППР-заявки");
  }

  const priorHold = {
    reason: task.hold_reason,
    held_at: task.held_at,
    held_by: task.held_by,
    purchase_request_id: task.hold_purchase_request_id,
  };

  const { data, error } = await supabase
    .from("ppr_tasks")
    .update({
      status: "in_progress",
      hold_reason: null,
      held_at: null,
      held_by: null,
      hold_purchase_request_id: null,
    })
    .eq("id", taskId)
    .eq("status", "on_hold")
    .select("id")
    .maybeSingle();
  if (error) throw error;
  if (!data) {
    throw new Error("ППР-заявка больше не находится на паузе");
  }

  await writeAudit({
    actorId: profile.id,
    action: "resume_ppr_task",
    entityType: "ppr_task",
    entityId: taskId,
    meta: {
      object_id: task.object_id,
      from: task.status,
      to: "in_progress",
      prior_hold: priorHold,
    },
  });

  revalidateTaskPaths(taskId);
}
