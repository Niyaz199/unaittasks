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

  return {
    anchorDate: toDateOnly(anchor),
    currentMonthStart,
    currentMonthEnd,
    nextMonthStart,
    currentMonthPlan,
    materialization,
    sync,
    nextMonthPlan,
  };
}
