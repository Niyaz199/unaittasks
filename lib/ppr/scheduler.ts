import type { SupabaseClient } from "@supabase/supabase-js";

const PPR_MONTH_PLAN_BATCH_SIZE = 500;

type TemplateForPlan = {
  id: string;
  object_id: string;
  system_id: string;
  base_start_date: string;
  period_months: number;
};

type EquipmentForPlan = {
  id: string;
  object_id: string;
  system_id: string;
  created_at: string;
  service_start_date: string;
};

function toDateOnly(value: Date) {
  return value.toISOString().slice(0, 10);
}

function firstDayOfMonth(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function lastDayOfMonth(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0));
}

function addMonths(date: Date, months: number) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1));
}

function parseDate(value: string) {
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Некорректная дата: ${value}`);
  }
  return parsed;
}

function parseTimestamp(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Некорректный timestamp: ${value}`);
  }
  return parsed;
}

function clampDay(year: number, monthIndex: number, day: number) {
  const lastDay = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  return Math.min(day, lastDay);
}

function monthDiff(from: Date, to: Date) {
  return (to.getUTCFullYear() - from.getUTCFullYear()) * 12 + (to.getUTCMonth() - from.getUTCMonth());
}

function parsePlanMonth(value: string) {
  const normalized = value.trim();
  const parsed = /^\d{4}-\d{2}$/.test(normalized)
    ? new Date(`${normalized}-01T00:00:00.000Z`)
    : /^\d{4}-\d{2}-\d{2}$/.test(normalized)
      ? new Date(`${normalized}T00:00:00.000Z`)
      : new Date(Number.NaN);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error("Некорректный месяц плана");
  }
  return firstDayOfMonth(parsed);
}

export function normalizePlanMonth(value: string) {
  return toDateOnly(parsePlanMonth(value));
}

export function defaultPlannedFor(planMonth: string) {
  return normalizePlanMonth(planMonth);
}

export function calculateTemplateDueDateForPlanMonth(startDate: string, periodMonths: number, planMonth: string) {
  const start = parseDate(startDate);
  const monthStart = parseDate(normalizePlanMonth(planMonth));
  if (start > lastDayOfMonth(monthStart)) {
    return null;
  }

  const diff = monthDiff(firstDayOfMonth(start), monthStart);
  if (diff < 0 || diff % periodMonths !== 0) {
    return null;
  }

  const day = clampDay(monthStart.getUTCFullYear(), monthStart.getUTCMonth(), start.getUTCDate());
  return toDateOnly(new Date(Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth(), day)));
}

function chunkArray<T>(items: T[], size: number) {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function asCount(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

export async function generateMonthPlanForSystem(
  supabase: SupabaseClient,
  input: { systemId: string; planMonth: string }
) {
  const normalizedPlanMonth = normalizePlanMonth(input.planMonth);
  const planMonthKey = normalizedPlanMonth.slice(0, 7);

  const { data: system, error: systemError } = await supabase
    .from("ppr_systems")
    .select("id,object_id")
    .eq("id", input.systemId)
    .single();
  if (systemError) throw systemError;

  const { data: monthPlan, error: monthPlanError } = await supabase
    .from("ppr_month_plans")
    .upsert(
      {
        object_id: system.object_id,
        system_id: input.systemId,
        plan_month: normalizedPlanMonth,
      },
      {
        onConflict: "object_id,system_id,plan_month",
      }
    )
    .select("id,object_id,system_id,plan_month,generated_at")
    .single();
  if (monthPlanError) throw monthPlanError;

  const [{ data: templates, error: templatesError }, { data: equipment, error: equipmentError }] = await Promise.all([
    supabase
      .from("ppr_work_templates")
      .select("id,object_id,system_id,base_start_date,period_months")
      .eq("object_id", system.object_id)
      .eq("system_id", input.systemId)
      .eq("is_active", true),
    supabase
      .from("ppr_equipment")
      .select("id,object_id,system_id,created_at,service_start_date")
      .eq("object_id", system.object_id)
      .eq("system_id", input.systemId)
      .eq("status", "active"),
  ]);
  if (templatesError) throw templatesError;
  if (equipmentError) throw equipmentError;

  const activeTemplates = (templates ?? []) as TemplateForPlan[];
  const activeEquipment = (equipment ?? []) as EquipmentForPlan[];

  const { data: existingItems, error: existingItemsError } = await supabase
    .from("ppr_month_plan_items")
    .select("equipment_id,template_id,source_due_date")
    .eq("month_plan_id", monthPlan.id);
  if (existingItemsError) throw existingItemsError;

  const existingKeys = new Set(
    ((existingItems ?? []) as Array<{ equipment_id: string; template_id: string; source_due_date: string }>).map(
      (item) => `${item.equipment_id}:${item.template_id}:${item.source_due_date}`
    )
  );

  const insertRows = activeTemplates.flatMap((template) => {
    const dueDate = calculateTemplateDueDateForPlanMonth(template.base_start_date, template.period_months, planMonthKey);
    if (!dueDate) return [];

    return activeEquipment
      .filter((item) => item.service_start_date <= dueDate)
      .filter((item) => parseTimestamp(item.created_at) <= parseTimestamp(monthPlan.generated_at))
      .map((item) => ({
        object_id: system.object_id,
        month_plan_id: monthPlan.id,
        system_id: input.systemId,
        equipment_id: item.id,
        template_id: template.id,
        planned_for: defaultPlannedFor(normalizedPlanMonth),
        source_due_date: dueDate,
        is_overdue: dueDate < toDateOnly(new Date()),
        is_carried_over: false,
        task_id: null,
        status: "pending" as const,
      }));
  }).filter((row) => !existingKeys.has(`${row.equipment_id}:${row.template_id}:${row.source_due_date}`));
  if (!insertRows.length) {
    return {
      monthPlanId: monthPlan.id,
      normalizedPlanMonth,
      generatedItems: 0,
      touchedRows: 0,
    };
  }

  let insertedCount = 0;
  for (const batch of chunkArray(insertRows, PPR_MONTH_PLAN_BATCH_SIZE)) {
    const { data, error } = await supabase
      .from("ppr_month_plan_items")
      .upsert(batch, {
        onConflict: "month_plan_id,equipment_id,template_id,source_due_date",
        ignoreDuplicates: true,
      })
      .select("id");
    if (error) throw error;
    insertedCount += (data ?? []).length;
  }
  return {
    monthPlanId: monthPlan.id,
    normalizedPlanMonth,
    generatedItems: insertRows.length,
    touchedRows: insertedCount,
  };
}

export async function generateMonthPlansForActiveSystems(
  supabase: SupabaseClient,
  input: { planMonth: string }
) {
  const normalizedPlanMonth = normalizePlanMonth(input.planMonth);
  const { data, error } = await supabase
    .from("ppr_work_templates")
    .select("system_id")
    .eq("is_active", true);
  if (error) throw error;

  const systemIds = [...new Set((data ?? []).map((row) => row.system_id).filter(Boolean))];

  let generatedItems = 0;
  let touchedRows = 0;
  const monthPlanIds: string[] = [];

  for (const systemId of systemIds) {
    const result = await generateMonthPlanForSystem(supabase, {
      systemId,
      planMonth: normalizedPlanMonth,
    });
    generatedItems += result.generatedItems;
    touchedRows += result.touchedRows;
    monthPlanIds.push(result.monthPlanId);
  }

  return {
    planMonth: normalizedPlanMonth,
    systemCount: systemIds.length,
    generatedItems,
    touchedRows,
    monthPlanIds,
  };
}

type MaterializeInput = {
  dateFrom: string;
  dateTo: string;
};

type ChecklistSnapshotItem = {
  sort_order: number;
  title: string;
  description: string | null;
};

export async function materializePlanItemsInRange(supabase: SupabaseClient, input: MaterializeInput) {
  const result = await runPprCronStep(supabase, "ppr_materialize_plan_items", {
    dateFrom: input.dateFrom,
    dateTo: input.dateTo,
    runId: crypto.randomUUID(),
  });

  return {
    createdTasks: asCount(result.created_tasks),
    linkedPlanItems: asCount(result.linked_plan_items),
    createdWorkItems: asCount(result.created_work_items),
  };
}

export type PprCronRunInput = {
  dateFrom: string;
  dateTo: string;
  runId: string;
};

type PprCronStepResult = Record<string, unknown>;

function assertCronRange(dateFrom: string, dateTo: string) {
  const from = parseDate(dateFrom);
  const to = parseDate(dateTo);
  if (from > to) {
    throw new Error("date_from must be less than or equal to date_to");
  }
}

export async function runPprCronStep(
  supabase: SupabaseClient,
  step: "ppr_carryover_plan_items" | "ppr_materialize_plan_items" | "ppr_sync_plan_item_statuses",
  input: PprCronRunInput
) {
  assertCronRange(input.dateFrom, input.dateTo);
  const { data, error } = await supabase.rpc(step, {
    _date_from: input.dateFrom,
    _date_to: input.dateTo,
    _run_id: input.runId,
  });
  if (error) throw error;
  return ((data ?? {}) as PprCronStepResult) ?? {};
}

export async function runPprCronOrchestration(supabase: SupabaseClient, input: PprCronRunInput) {
  assertCronRange(input.dateFrom, input.dateTo);

  const carryover = await runPprCronStep(supabase, "ppr_carryover_plan_items", input);
  const materialization = await runPprCronStep(supabase, "ppr_materialize_plan_items", input);
  const sync = await runPprCronStep(supabase, "ppr_sync_plan_item_statuses", input);

  return {
    carryover,
    materialization,
    sync,
  };
}

export type PprPurchaseRequestGenerationResult = {
  planMonth: string;
  objectsProcessed: number;
  requestsCreated: number;
  requestsUpdated: number;
  itemsInserted: number;
  deficitItems: number;
};

async function findProcurementManagerId(supabase: SupabaseClient): Promise<string | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id")
    .eq("role", "procurement_manager")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data?.id ?? null;
}

/**
 * После генерации месячного плана ППР считает потребность в ТМЦ для in_house шаблонов
 * и создаёт/обновляет заявки на закупку (source='ppr') для менеджера по закупкам.
 * Идемпотентно по (object_id, ppr_plan_month): если заявка уже есть — её позиции пересоздаются.
 */
export async function generatePprPurchaseRequestsForMonth(
  supabase: SupabaseClient,
  input: { planMonth: string }
): Promise<PprPurchaseRequestGenerationResult> {
  const normalizedPlanMonth = normalizePlanMonth(input.planMonth);

  // 1. Забираем планы и их позиции за целевой месяц
  const { data: monthPlans, error: monthPlansError } = await supabase
    .from("ppr_month_plans")
    .select("id,object_id,system_id,plan_month")
    .eq("plan_month", normalizedPlanMonth);
  if (monthPlansError) throw monthPlansError;
  const plans = (monthPlans ?? []) as Array<{ id: string; object_id: string; system_id: string; plan_month: string }>;
  if (!plans.length) {
    return {
      planMonth: normalizedPlanMonth,
      objectsProcessed: 0,
      requestsCreated: 0,
      requestsUpdated: 0,
      itemsInserted: 0,
      deficitItems: 0,
    };
  }

  const planIds = plans.map((p) => p.id);
  const { data: planItems, error: planItemsError } = await supabase
    .from("ppr_month_plan_items")
    .select("object_id,template_id")
    .in("month_plan_id", planIds);
  if (planItemsError) throw planItemsError;

  // Считаем количество plan-items на (object_id, template_id)
  const planItemCounts = new Map<string, number>(); // key: `${object_id}:${template_id}`
  for (const row of (planItems ?? []) as Array<{ object_id: string; template_id: string }>) {
    const key = `${row.object_id}:${row.template_id}`;
    planItemCounts.set(key, (planItemCounts.get(key) ?? 0) + 1);
  }
  if (!planItemCounts.size) {
    return {
      planMonth: normalizedPlanMonth,
      objectsProcessed: 0,
      requestsCreated: 0,
      requestsUpdated: 0,
      itemsInserted: 0,
      deficitItems: 0,
    };
  }

  // 2. Исключаем contractor-шаблоны
  const templateIds = [...new Set((planItems ?? []).map((r: { template_id: string }) => r.template_id))];
  const { data: templates, error: templatesError } = await supabase
    .from("ppr_work_templates")
    .select("id,system_id,execution_mode")
    .in("id", templateIds);
  if (templatesError) throw templatesError;

  const eligibleTemplates = new Map<string, { system_id: string }>();
  for (const row of (templates ?? []) as Array<{ id: string; system_id: string; execution_mode: "in_house" | "contractor" }>) {
    if (row.execution_mode !== "contractor") {
      eligibleTemplates.set(row.id, { system_id: row.system_id });
    }
  }
  if (!eligibleTemplates.size) {
    return {
      planMonth: normalizedPlanMonth,
      objectsProcessed: 0,
      requestsCreated: 0,
      requestsUpdated: 0,
      itemsInserted: 0,
      deficitItems: 0,
    };
  }

  // 3. Подгружаем связи stock_item_ppr_templates только по eligible шаблонам
  const eligibleTemplateIds = [...eligibleTemplates.keys()];
  const { data: links, error: linksError } = await supabase
    .from("stock_item_ppr_templates")
    .select("object_id,stock_item_id,template_id,required_qty")
    .in("template_id", eligibleTemplateIds);
  if (linksError) throw linksError;

  // 4. Считаем total_needed по (object_id, stock_item_id), храним вклад каждой системы
  type ItemAggregate = {
    totalNeeded: number;
    systems: Map<string, number>; // system_id -> вклад (для выбора «первичного» system_id в позиции)
  };
  const needByItem = new Map<string, ItemAggregate>(); // `${object_id}:${stock_item_id}`

  for (const row of (links ?? []) as Array<{
    object_id: string;
    stock_item_id: string;
    template_id: string;
    required_qty: number;
  }>) {
    const templateInfo = eligibleTemplates.get(row.template_id);
    if (!templateInfo) continue;
    const planKey = `${row.object_id}:${row.template_id}`;
    const planCount = planItemCounts.get(planKey) ?? 0;
    if (planCount <= 0) continue;
    const contribution = planCount * Number(row.required_qty);
    if (!Number.isFinite(contribution) || contribution <= 0) continue;

    const itemKey = `${row.object_id}:${row.stock_item_id}`;
    const entry = needByItem.get(itemKey) ?? { totalNeeded: 0, systems: new Map() };
    entry.totalNeeded += contribution;
    entry.systems.set(templateInfo.system_id, (entry.systems.get(templateInfo.system_id) ?? 0) + contribution);
    needByItem.set(itemKey, entry);
  }

  if (!needByItem.size) {
    return {
      planMonth: normalizedPlanMonth,
      objectsProcessed: 0,
      requestsCreated: 0,
      requestsUpdated: 0,
      itemsInserted: 0,
      deficitItems: 0,
    };
  }

  // 5. Забираем current_qty/min_qty для всех задействованных stock_items
  const stockItemIds = [...new Set([...needByItem.keys()].map((k) => k.split(":")[1]))];
  const { data: stockRows, error: stockRowsError } = await supabase
    .from("stock_items")
    .select("id,object_id,name,unit,current_qty,min_qty")
    .in("id", stockItemIds);
  if (stockRowsError) throw stockRowsError;
  const stockById = new Map<
    string,
    { id: string; object_id: string; name: string; unit: string; current_qty: number; min_qty: number }
  >();
  for (const row of (stockRows ?? []) as Array<{
    id: string;
    object_id: string;
    name: string;
    unit: string;
    current_qty: number;
    min_qty: number;
  }>) {
    stockById.set(row.id, row);
  }

  // 6. Формируем дефицит по объектам
  type DeficitRow = {
    stock_item_id: string;
    title: string;
    unit: string;
    quantity: number;
    current_qty: number;
    min_qty: number;
    ppr_system_id: string | null;
  };
  const deficitByObject = new Map<string, DeficitRow[]>();

  for (const [key, aggregate] of needByItem.entries()) {
    const [objectId, stockItemId] = key.split(":");
    const stock = stockById.get(stockItemId);
    if (!stock || stock.object_id !== objectId) continue;

    const deficit = aggregate.totalNeeded - Number(stock.current_qty ?? 0);
    if (deficit <= 0) continue;

    // Выбираем «главную» систему — ту, которая даёт максимальный вклад
    let primarySystemId: string | null = null;
    let bestContribution = -Infinity;
    for (const [systemId, contribution] of aggregate.systems.entries()) {
      if (contribution > bestContribution) {
        bestContribution = contribution;
        primarySystemId = systemId;
      }
    }

    const list = deficitByObject.get(objectId) ?? [];
    list.push({
      stock_item_id: stockItemId,
      title: stock.name,
      unit: stock.unit,
      quantity: Number(deficit.toFixed(3)),
      current_qty: Number(stock.current_qty ?? 0),
      min_qty: Number(stock.min_qty ?? 0),
      ppr_system_id: primarySystemId,
    });
    deficitByObject.set(objectId, list);
  }

  if (!deficitByObject.size) {
    return {
      planMonth: normalizedPlanMonth,
      objectsProcessed: 0,
      requestsCreated: 0,
      requestsUpdated: 0,
      itemsInserted: 0,
      deficitItems: 0,
    };
  }

  // 7. Ищем менеджера по закупкам (может быть null — тогда заявка без assignee)
  const procurementManagerId = await findProcurementManagerId(supabase);

  let requestsCreated = 0;
  let requestsUpdated = 0;
  let itemsInserted = 0;
  let totalDeficitItems = 0;

  const planMonthKey = normalizedPlanMonth.slice(0, 7);
  const description = `Заявка ППР на ${planMonthKey}`;

  for (const [objectId, items] of deficitByObject.entries()) {
    totalDeficitItems += items.length;

    // Идемпотентность: проверяем, есть ли уже заявка для (object_id, source=ppr, ppr_plan_month)
    const { data: existingRequest, error: existingError } = await supabase
      .from("purchase_requests")
      .select("id,status")
      .eq("object_id", objectId)
      .eq("source", "ppr")
      .eq("ppr_plan_month", normalizedPlanMonth)
      .maybeSingle();
    if (existingError) throw existingError;

    let requestId: string;
    if (existingRequest) {
      // Перегенерация: очищаем прежние позиции (только если заявка ещё активна)
      if (existingRequest.status === "fulfilled" || existingRequest.status === "cancelled") {
        // Не трогаем закрытые/отменённые заявки
        continue;
      }
      requestId = existingRequest.id;
      const { error: deleteError } = await supabase
        .from("purchase_request_items")
        .delete()
        .eq("request_id", requestId);
      if (deleteError) throw deleteError;
      requestsUpdated += 1;
    } else {
      const { data: created, error: createError } = await supabase
        .from("purchase_requests")
        .insert({
          object_id: objectId,
          source: "ppr",
          request_kind: "final",
          status: "new",
          executor_role: "procurement_manager",
          assigned_to: procurementManagerId,
          requested_by: null,
          description,
          ppr_plan_month: normalizedPlanMonth,
        })
        .select("id")
        .single();
      if (createError) throw createError;
      requestId = created.id;
      requestsCreated += 1;
    }

    // Вставляем позиции
    const itemsPayload = items.map((item) => ({
      request_id: requestId,
      object_id: objectId,
      stock_item_id: item.stock_item_id,
      title: item.title,
      unit: item.unit,
      quantity_requested: item.quantity,
      note: null,
      is_auto_generated: true,
      assigned_role: "procurement_manager" as const,
      current_qty_snapshot: item.current_qty,
      min_qty_snapshot: item.min_qty,
      storage_location_id: null,
      location_name_snapshot: null,
      characteristics: null,
      ppr_system_id: item.ppr_system_id,
    }));

    for (const batch of chunkArray(itemsPayload, PPR_MONTH_PLAN_BATCH_SIZE)) {
      const { data: inserted, error: itemsError } = await supabase
        .from("purchase_request_items")
        .insert(batch)
        .select("id");
      if (itemsError) throw itemsError;
      itemsInserted += (inserted ?? []).length;
    }
  }

  return {
    planMonth: normalizedPlanMonth,
    objectsProcessed: deficitByObject.size,
    requestsCreated,
    requestsUpdated,
    itemsInserted,
    deficitItems: totalDeficitItems,
  };
}

export async function runPprMonthlyCycle(
  supabase: SupabaseClient,
  input: { anchorDate?: string; runId: string }
) {
  const anchor = parseDate(input.anchorDate ?? toDateOnly(new Date()));
  const currentMonthStart = toDateOnly(firstDayOfMonth(anchor));
  const currentMonthEnd = toDateOnly(lastDayOfMonth(anchor));
  const nextMonthStart = toDateOnly(addMonths(anchor, 1));

  const currentMonthPlan = await generateMonthPlansForActiveSystems(supabase, {
    planMonth: currentMonthStart,
  });

  const materialization = await runPprCronStep(supabase, "ppr_materialize_plan_items", {
    dateFrom: currentMonthStart,
    dateTo: currentMonthEnd,
    runId: input.runId,
  });

  const sync = await runPprCronStep(supabase, "ppr_sync_plan_item_statuses", {
    dateFrom: currentMonthStart,
    dateTo: currentMonthEnd,
    runId: input.runId,
  });

  const nextMonthPlan = await generateMonthPlansForActiveSystems(supabase, {
    planMonth: nextMonthStart,
  });

  // После генерации плана на следующий месяц — создаём заявки ППР на закупку ТМЦ
  const pprPurchaseRequests = await generatePprPurchaseRequestsForMonth(supabase, {
    planMonth: nextMonthStart,
  });

  return {
    anchorDate: toDateOnly(anchor),
    currentMonthStart,
    currentMonthEnd,
    nextMonthStart,
    currentMonthPlan,
    materialization,
    sync,
    nextMonthPlan,
    pprPurchaseRequests,
  };
}
