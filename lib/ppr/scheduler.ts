import type { SupabaseClient } from "@supabase/supabase-js";
import { getActivePprTaskByAggregation, listMaterializablePlanItemsForRange } from "@/lib/ppr/queries";

type AssignmentForPlan = {
  id: string;
  object_id: string;
  equipment_id: string;
  template_id: string;
  start_date: string;
  period_months: number;
  equipment: { id: string; system_id: string; subsystem_id: string } | Array<{ id: string; system_id: string; subsystem_id: string }> | null;
  template: { id: string; subsystem_id: string } | Array<{ id: string; subsystem_id: string }> | null;
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

export function normalizePlanMonth(value: string) {
  const parsed = new Date(`${value}-01T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error("Некорректный месяц плана");
  }
  return toDateOnly(firstDayOfMonth(parsed));
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

export async function generateMonthPlanForSystem(
  supabase: SupabaseClient,
  input: { systemId: string; planMonth: string }
) {
  const normalizedPlanMonth = normalizePlanMonth(input.planMonth);

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
    .select("id,object_id,equipment_id,template_id,start_date,period_months,equipment:ppr_equipment(id,system_id,subsystem_id),template:ppr_work_templates(id,subsystem_id)")
    .eq("object_id", system.object_id)
    .eq("is_active", true);
  if (assignmentsError) throw assignmentsError;

  const rows = ((assignments ?? []) as AssignmentForPlan[]).filter((assignment) => {
    const equipment = Array.isArray(assignment.equipment) ? assignment.equipment[0] : assignment.equipment;
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
      const dueDate = calculateAssignmentDueDateForPlanMonth(assignment.start_date, assignment.period_months, normalizedPlanMonth);
      if (!dueDate) return null;

      const equipment = Array.isArray(assignment.equipment) ? assignment.equipment[0] : assignment.equipment;
      const template = Array.isArray(assignment.template) ? assignment.template[0] : assignment.template;
      if (!equipment || !template) return null;

      return {
        object_id: system.object_id,
        month_plan_id: monthPlan.id,
        system_id: input.systemId,
        subsystem_id: equipment.subsystem_id,
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

  let insertedCount = 0;
  for (const row of insertRows) {
    const { error } = await supabase
      .from("ppr_month_plan_items")
      .insert(row);
    if (error) throw error;
    insertedCount += 1;
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

function resolveSingle<T>(value: T | T[] | null | undefined) {
  return Array.isArray(value) ? value[0] ?? null : (value ?? null);
}

export async function materializePlanItemsInRange(supabase: SupabaseClient, input: MaterializeInput) {
  const planItems = await listMaterializablePlanItemsForRange(supabase, input);
  if (!planItems.length) {
    return {
      createdTasks: 0,
      linkedPlanItems: 0,
      createdWorkItems: 0,
    };
  }

  const templateIds = [...new Set(planItems.map((item) => item.template_id))];
  const { data: checklistRows, error: checklistError } = await supabase
    .from("ppr_work_checklist_items")
    .select("template_id,sort_order,title,description")
    .in("template_id", templateIds)
    .order("sort_order", { ascending: true });
  if (checklistError) throw checklistError;

  const checklistByTemplate = new Map<string, ChecklistSnapshotItem[]>();
  for (const row of (checklistRows ?? []) as Array<{
    template_id: string;
    sort_order: number;
    title: string;
    description: string | null;
  }>) {
    const current = checklistByTemplate.get(row.template_id) ?? [];
    current.push({
      sort_order: row.sort_order,
      title: row.title,
      description: row.description ?? null,
    });
    checklistByTemplate.set(row.template_id, current);
  }

  const groups = new Map<string, typeof planItems>();
  for (const item of planItems) {
    const key = `${item.object_id}:${item.equipment_id}:${item.planned_for}`;
    const current = groups.get(key) ?? [];
    current.push(item);
    groups.set(key, current);
  }

  let createdTasks = 0;
  let linkedPlanItems = 0;
  let createdWorkItems = 0;

  for (const group of groups.values()) {
    const first = group[0];
    const system = resolveSingle(first.system);
    if (!system?.responsible_user_id) {
      throw new Error(`У системы ${first.system_id} не задан responsible_user_id для materialization`);
    }

    let task = await getActivePprTaskByAggregation(supabase, {
      equipmentId: first.equipment_id,
      plannedFor: first.planned_for,
    });

    if (!task) {
      const { data: createdTask, error: taskError } = await supabase
        .from("ppr_tasks")
        .insert({
          object_id: first.object_id,
          system_id: first.system_id,
          subsystem_id: first.subsystem_id,
          equipment_id: first.equipment_id,
          responsible_user_id: system.responsible_user_id,
          planned_for: first.planned_for,
          status: "new",
          is_overdue: group.some((item) => item.is_overdue),
          is_rescheduled: group.some((item) => item.is_carried_over),
        })
        .select(
          "id,object_id,system_id,subsystem_id,equipment_id,responsible_user_id,assignee_id,planned_for,completed_at,closed_at,cancelled_at,cancelled_by,status,is_overdue,is_rescheduled,general_comment,cancel_reason,created_at"
        )
        .single();
      if (taskError) throw taskError;
      task = createdTask;
      createdTasks += 1;
    }

    const { data: existingWorkItems, error: workItemsError } = await supabase
      .from("ppr_task_work_items")
      .select("assignment_id")
      .eq("task_id", task.id);
    if (workItemsError) throw workItemsError;

    const existingAssignmentIds = new Set(((existingWorkItems ?? []) as Array<{ assignment_id: string }>).map((item) => item.assignment_id));

    let nextSortOrder = existingAssignmentIds.size + 1;
    for (const item of group) {
      const template = resolveSingle(item.template);
      if (!template) {
        throw new Error(`Не найден template snapshot source для plan item ${item.id}`);
      }

      if (!existingAssignmentIds.has(item.assignment_id)) {
        const { error: insertWorkItemError } = await supabase.from("ppr_task_work_items").insert({
          object_id: item.object_id,
          task_id: task.id,
          assignment_id: item.assignment_id,
          template_id: item.template_id,
          plan_item_id: item.id,
          title_snapshot: template.name,
          description_snapshot: template.description ?? null,
          methodology_snapshot: template.methodology ?? null,
          checklist_snapshot: checklistByTemplate.get(item.template_id) ?? [],
          norm_hours_snapshot: template.norm_hours ?? null,
          sort_order: nextSortOrder,
        });
        if (insertWorkItemError) throw insertWorkItemError;
        existingAssignmentIds.add(item.assignment_id);
        nextSortOrder += 1;
        createdWorkItems += 1;
      } else {
        const { error: updatePlanLinkError } = await supabase
          .from("ppr_task_work_items")
          .update({ plan_item_id: item.id })
          .eq("task_id", task.id)
          .eq("assignment_id", item.assignment_id)
          .is("plan_item_id", null);
        if (updatePlanLinkError) throw updatePlanLinkError;
      }

      const { error: updatePlanItemError } = await supabase
        .from("ppr_month_plan_items")
        .update({
          task_id: task.id,
          status: "materialized",
        })
        .eq("id", item.id)
        .is("task_id", null);
      if (updatePlanItemError) throw updatePlanItemError;
      linkedPlanItems += 1;
    }
  }

  return {
    createdTasks,
    linkedPlanItems,
    createdWorkItems,
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
