import type { SupabaseClient } from "@supabase/supabase-js";
import { unwrapRelation, type RelationValue } from "@/lib/relation-normalization";

type AssignmentForPlan = {
  id: string;
  object_id: string;
  equipment_id: string;
  template_id: string;
  start_date: string;
  period_months: number;
  equipment: RelationValue<{ id: string; system_id: string }>;
  template: RelationValue<{ id: string; system_id: string }>;
};

const PPR_MONTH_PLAN_BATCH_SIZE = 500;

function toDateOnly(value: Date) {
  return value.toISOString().slice(0, 10);
}

function firstDayOfMonth(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function lastDayOfMonth(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0));
}

function parseDate(value: string) {
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Некорректная дата: ${value}`);
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

export function calculateAssignmentDueDateForPlanMonth(startDate: string, periodMonths: number, planMonth: string) {
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
    .select("id,object_id,system_id,plan_month")
    .single();
  if (monthPlanError) throw monthPlanError;

  const { data: assignments, error: assignmentsError } = await supabase
    .from("ppr_equipment_work_assignments")
    .select("id,object_id,equipment_id,template_id,start_date,period_months,equipment:ppr_equipment(id,system_id),template:ppr_work_templates(id,system_id)")
    .eq("object_id", system.object_id)
    .eq("is_active", true);
  if (assignmentsError) throw assignmentsError;

  const rows = ((assignments ?? []) as AssignmentForPlan[]).filter((assignment) => {
    const equipment = unwrapRelation(assignment.equipment);
    return equipment?.system_id === input.systemId;
  });

  const { data: existingItems, error: existingItemsError } = await supabase
    .from("ppr_month_plan_items")
    .select("assignment_id,source_due_date")
    .eq("month_plan_id", monthPlan.id);
  if (existingItemsError) throw existingItemsError;

  const existingKeys = new Set(
    ((existingItems ?? []) as Array<{ assignment_id: string; source_due_date: string }>).map(
      (item) => `${item.assignment_id}:${item.source_due_date}`
    )
  );

  const insertRows = rows
    .map((assignment) => {
      const dueDate = calculateAssignmentDueDateForPlanMonth(assignment.start_date, assignment.period_months, planMonthKey);
      if (!dueDate) return null;

      const equipment = unwrapRelation(assignment.equipment);
      const template = unwrapRelation(assignment.template);
      if (!equipment || !template) return null;

      return {
        object_id: system.object_id,
        month_plan_id: monthPlan.id,
        system_id: input.systemId,
        equipment_id: assignment.equipment_id,
        assignment_id: assignment.id,
        template_id: assignment.template_id,
        planned_for: defaultPlannedFor(normalizedPlanMonth),
        source_due_date: dueDate,
        is_overdue: dueDate < toDateOnly(new Date()),
        is_carried_over: false,
        task_id: null,
        status: "pending" as const,
      };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null)
    .filter((row) => !existingKeys.has(`${row.assignment_id}:${row.source_due_date}`));

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
        onConflict: "month_plan_id,assignment_id,source_due_date",
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
