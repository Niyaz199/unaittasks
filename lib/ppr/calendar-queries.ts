import { cache } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { unwrapRelation, type RelationValue } from "@/lib/relation-normalization";
import type { Profile } from "@/lib/types";
import { assertPprCalendarQueryAccess, listPprManageableObjectsForProfile } from "@/lib/ppr/access";

type PprCalendarRawTemplateRelation = RelationValue<{ norm_hours: number | null }>;

function buildCalendarMonthKeys(year: number) {
  return Array.from({ length: 12 }, (_, index) => `${year}-${String(index + 1).padStart(2, "0")}`);
}

export type PprCalendarAggregatedMetrics = {
  items_count: number;
  norm_hours_total: number;
  overdue_count: number;
  carried_over_count: number;
  pending_count: number;
  materialized_count: number;
  closed_count: number;
  cancelled_count: number;
};

export type PprCalendarMonthMetrics = PprCalendarAggregatedMetrics & {
  month: string;
};

function createEmptyCalendarMetrics(month: string): PprCalendarMonthMetrics {
  return {
    month,
    items_count: 0,
    norm_hours_total: 0,
    overdue_count: 0,
    carried_over_count: 0,
    pending_count: 0,
    materialized_count: 0,
    closed_count: 0,
    cancelled_count: 0,
  };
}

function cloneCalendarTotals(): PprCalendarAggregatedMetrics {
  return {
    items_count: 0,
    norm_hours_total: 0,
    overdue_count: 0,
    carried_over_count: 0,
    pending_count: 0,
    materialized_count: 0,
    closed_count: 0,
    cancelled_count: 0,
  };
}

function accumulateCalendarMetrics(
  target: PprCalendarAggregatedMetrics,
  input: {
    status: "pending" | "materialized" | "carried_over" | "closed" | "cancelled";
    is_overdue: boolean;
    is_carried_over: boolean;
    norm_hours: number | null;
  }
) {
  target.items_count += 1;
  target.norm_hours_total += input.norm_hours ?? 0;
  if (input.is_overdue) target.overdue_count += 1;
  if (input.is_carried_over) target.carried_over_count += 1;
  if (input.status === "pending") target.pending_count += 1;
  if (input.status === "materialized") target.materialized_count += 1;
  if (input.status === "closed") target.closed_count += 1;
  if (input.status === "cancelled") target.cancelled_count += 1;
}

const listPprCalendarSystemsCached = cache(
  async (
    supabase: SupabaseClient,
    profileId: string,
    role: Profile["role"]
  ): Promise<
    Array<{
      id: string;
      object_id: string;
      system_group_id: string;
      name: string;
      responsible_user_id: string | null;
      object: { name: string } | Array<{ name: string }> | null;
      system_group: { name: string; code: string } | Array<{ name: string; code: string }> | null;
    }>
  > => {
    const baseQuery = supabase
      .from("ppr_systems")
      .select("id,object_id,system_group_id,name,responsible_user_id,object:objects(name),system_group:ppr_system_groups(name,code)")
      .order("name", { ascending: true });

    if (role === "admin" || role === "chief") {
      const { data, error } = await baseQuery;
      if (error) throw error;
      return (data ?? []) as Array<{
        id: string;
        object_id: string;
        system_group_id: string;
        name: string;
        responsible_user_id: string | null;
        object: { name: string } | Array<{ name: string }> | null;
        system_group: { name: string; code: string } | Array<{ name: string; code: string }> | null;
      }>;
    }

    if (role === "engineer") {
      const { data, error } = await baseQuery.eq("responsible_user_id", profileId);
      if (error) throw error;
      return (data ?? []) as Array<{
        id: string;
        object_id: string;
        system_group_id: string;
        name: string;
        responsible_user_id: string | null;
        object: { name: string } | Array<{ name: string }> | null;
        system_group: { name: string; code: string } | Array<{ name: string; code: string }> | null;
      }>;
    }

    const manageableObjects = await listPprManageableObjectsForProfile(supabase, { id: profileId, role });
    if (!manageableObjects.length) return [];

    const { data, error } = await baseQuery.in(
      "object_id",
      manageableObjects.map((item) => item.id)
    );
    if (error) throw error;
    return (data ?? []) as Array<{
      id: string;
      object_id: string;
      system_group_id: string;
      name: string;
      responsible_user_id: string | null;
      object: { name: string } | Array<{ name: string }> | null;
      system_group: { name: string; code: string } | Array<{ name: string; code: string }> | null;
    }>;
  }
);

export async function listPprCalendarSystemsForProfile(supabase: SupabaseClient, profile: Pick<Profile, "id" | "role">) {
  assertPprCalendarQueryAccess(profile.role);
  return listPprCalendarSystemsCached(supabase, profile.id, profile.role);
}

export async function listPprCalendarSystemGroupsForProfile(
  supabase: SupabaseClient,
  profile: Pick<Profile, "id" | "role">
) {
  const systems = await listPprCalendarSystemsForProfile(supabase, profile);
  const groups = new Map<
    string,
    {
      id: string;
      name: string;
      code: string;
      systems_count: number;
    }
  >();

  for (const system of systems) {
    const systemGroup = unwrapRelation(system.system_group);
    if (!systemGroup) continue;
    const current = groups.get(system.system_group_id);
    if (current) {
      current.systems_count += 1;
      continue;
    }
    groups.set(system.system_group_id, {
      id: system.system_group_id,
      name: systemGroup.name,
      code: systemGroup.code,
      systems_count: 1,
    });
  }

  return [...groups.values()].sort((left, right) => left.name.localeCompare(right.name, "ru"));
}

export type PprCalendarYearGroupOverviewRow = {
  system_group_id: string;
  name: string;
  code: string;
  systems_count: number;
  months: PprCalendarMonthMetrics[];
  totals: PprCalendarAggregatedMetrics;
};

export type PprCalendarYearSystemOverviewRow = {
  system_id: string;
  system_group_id: string;
  object_id: string;
  object_name: string;
  name: string;
  responsible_user_id: string | null;
  months: PprCalendarMonthMetrics[];
  totals: PprCalendarAggregatedMetrics;
};

async function listPprCalendarScopedSystemsForProfile(
  supabase: SupabaseClient,
  profile: Pick<Profile, "id" | "role">,
  options: { objectId?: string; systemGroupId?: string; systemId?: string }
) {
  const systems = await listPprCalendarSystemsForProfile(supabase, profile);
  return systems.filter(
    (system) =>
      (!options.objectId || system.object_id === options.objectId) &&
      (!options.systemGroupId || system.system_group_id === options.systemGroupId) &&
      (!options.systemId || system.id === options.systemId)
  );
}

async function listPprCalendarYearRowsForSystems(supabase: SupabaseClient, systemIds: string[], year: number) {
  if (!systemIds.length) return [];

  const dateFrom = `${year}-01-01`;
  const dateTo = `${year}-12-31`;
  const { data, error } = await supabase
    .from("ppr_month_plan_items")
    .select("system_id,planned_for,is_overdue,is_carried_over,status,template:ppr_work_templates(norm_hours)")
    .in("system_id", systemIds)
    .gte("planned_for", dateFrom)
    .lte("planned_for", dateTo);
  if (error) throw error;
  return (data ?? []) as Array<{
    system_id: string;
    planned_for: string;
    is_overdue: boolean;
    is_carried_over: boolean;
    status: "pending" | "materialized" | "carried_over" | "closed" | "cancelled";
    template: PprCalendarRawTemplateRelation;
  }>;
}

export async function listPprCalendarYearOverviewByGroupForProfile(
  supabase: SupabaseClient,
  profile: Pick<Profile, "id" | "role">,
  options: { year: number; objectId?: string }
) {
  assertPprCalendarQueryAccess(profile.role);
  const systems = (await listPprCalendarSystemsForProfile(supabase, profile)).filter(
    (system) => !options.objectId || system.object_id === options.objectId
  );
  const months = buildCalendarMonthKeys(options.year);
  if (!systems.length) return [] as PprCalendarYearGroupOverviewRow[];

  const groupRows = new Map<string, PprCalendarYearGroupOverviewRow>();
  const systemToGroupId = new Map<string, string>();

  for (const system of systems) {
    const systemGroup = unwrapRelation(system.system_group);
    if (!systemGroup) continue;
    systemToGroupId.set(system.id, system.system_group_id);
    const current = groupRows.get(system.system_group_id);
    if (current) {
      current.systems_count += 1;
      continue;
    }
    groupRows.set(system.system_group_id, {
      system_group_id: system.system_group_id,
      name: systemGroup.name,
      code: systemGroup.code,
      systems_count: 1,
      months: months.map((month) => createEmptyCalendarMetrics(month)),
      totals: cloneCalendarTotals(),
    });
  }

  const rawRows = await listPprCalendarYearRowsForSystems(
    supabase,
    systems.map((system) => system.id),
    options.year
  );

  for (const row of rawRows) {
    const groupId = systemToGroupId.get(row.system_id);
    if (!groupId) continue;
    const target = groupRows.get(groupId);
    if (!target) continue;
    const monthKey = row.planned_for.slice(0, 7);
    const monthMetrics = target.months.find((item) => item.month === monthKey);
    if (!monthMetrics) continue;
    const template = unwrapRelation(row.template);
    const payload = {
      status: row.status,
      is_overdue: row.is_overdue,
      is_carried_over: row.is_carried_over,
      norm_hours: template?.norm_hours ?? null,
    };
    accumulateCalendarMetrics(monthMetrics, payload);
    accumulateCalendarMetrics(target.totals, payload);
  }

  return [...groupRows.values()].sort((left, right) => left.name.localeCompare(right.name, "ru"));
}

export async function listPprCalendarYearOverviewBySystemForProfile(
  supabase: SupabaseClient,
  profile: Pick<Profile, "id" | "role">,
  options: { year: number; systemGroupId: string; objectId?: string }
) {
  assertPprCalendarQueryAccess(profile.role);
  const systems = (await listPprCalendarSystemsForProfile(supabase, profile)).filter(
    (system) => system.system_group_id === options.systemGroupId && (!options.objectId || system.object_id === options.objectId)
  );
  const months = buildCalendarMonthKeys(options.year);
  if (!systems.length) return [] as PprCalendarYearSystemOverviewRow[];

  const systemRows = new Map<string, PprCalendarYearSystemOverviewRow>();
  for (const system of systems) {
    const object = unwrapRelation(system.object);
    systemRows.set(system.id, {
      system_id: system.id,
      system_group_id: system.system_group_id,
      object_id: system.object_id,
      object_name: object?.name ?? "—",
      name: system.name,
      responsible_user_id: system.responsible_user_id,
      months: months.map((month) => createEmptyCalendarMetrics(month)),
      totals: cloneCalendarTotals(),
    });
  }

  const rawRows = await listPprCalendarYearRowsForSystems(
    supabase,
    systems.map((system) => system.id),
    options.year
  );

  for (const row of rawRows) {
    const target = systemRows.get(row.system_id);
    if (!target) continue;
    const monthKey = row.planned_for.slice(0, 7);
    const monthMetrics = target.months.find((item) => item.month === monthKey);
    if (!monthMetrics) continue;
    const template = unwrapRelation(row.template);
    const payload = {
      status: row.status,
      is_overdue: row.is_overdue,
      is_carried_over: row.is_carried_over,
      norm_hours: template?.norm_hours ?? null,
    };
    accumulateCalendarMetrics(monthMetrics, payload);
    accumulateCalendarMetrics(target.totals, payload);
  }

  return [...systemRows.values()].sort((left, right) => {
    const objectCompare = left.object_name.localeCompare(right.object_name, "ru");
    if (objectCompare !== 0) return objectCompare;
    return left.name.localeCompare(right.name, "ru");
  });
}

export async function listPprMonthPlansForProfile(
  supabase: SupabaseClient,
  profile: Pick<Profile, "id" | "role">,
  options: { planMonth: string; systemId?: string; objectId?: string; systemGroupId?: string }
) {
  assertPprCalendarQueryAccess(profile.role);
  const systems = await listPprCalendarScopedSystemsForProfile(supabase, profile, {
    objectId: options.objectId,
    systemGroupId: options.systemGroupId,
    systemId: options.systemId,
  });
  const allowedSystemIds = systems.map((item) => item.id);
  if (!allowedSystemIds.length) return [];

  let query = supabase
    .from("ppr_month_plans")
    .select("id,object_id,system_id,plan_month,generated_at,object:objects(name),system:ppr_systems(name)")
    .eq("plan_month", options.planMonth)
    .in("system_id", allowedSystemIds)
    .order("generated_at", { ascending: false });

  if (options.objectId) {
    query = query.eq("object_id", options.objectId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as Array<{
    id: string;
    object_id: string;
    system_id: string;
    plan_month: string;
    generated_at: string;
    object: { name: string } | Array<{ name: string }> | null;
    system: { name: string } | Array<{ name: string }> | null;
  }>;
}

export async function listPprMonthPlanItemsForProfile(
  supabase: SupabaseClient,
  profile: Pick<Profile, "id" | "role">,
  options: { planMonth: string; systemId?: string; objectId?: string; systemGroupId?: string }
) {
  assertPprCalendarQueryAccess(profile.role);
  const systems = await listPprCalendarScopedSystemsForProfile(supabase, profile, {
    objectId: options.objectId,
    systemGroupId: options.systemGroupId,
    systemId: options.systemId,
  });
  const allowedSystemIds = systems.map((item) => item.id);
  if (!allowedSystemIds.length) return [];

  let monthPlanIdsQuery = supabase
    .from("ppr_month_plans")
    .select("id")
    .eq("plan_month", options.planMonth)
    .in("system_id", allowedSystemIds);

  if (options.objectId) {
    monthPlanIdsQuery = monthPlanIdsQuery.eq("object_id", options.objectId);
  }

  const { data: monthPlansData, error: monthPlansError } = await monthPlanIdsQuery;
  if (monthPlansError) throw monthPlansError;

  const monthPlanIds = ((monthPlansData ?? []) as Array<{ id: string }>).map((row) => row.id);
  if (!monthPlanIds.length) return [];

  let query = supabase
    .from("ppr_month_plan_items")
    .select(
      "id,object_id,month_plan_id,system_id,equipment_id,template_id,planned_for,source_due_date,is_overdue,is_carried_over,task_id,status,month_plan:ppr_month_plans(plan_month),equipment:ppr_equipment(name,inventory_no,room:object_rooms(name,floor,floor_ref:floors(name,sort_order),room_type:room_types(name))),template:ppr_work_templates(name,norm_hours),system:ppr_systems(name),object:objects(name),task:ppr_tasks(id,status,planned_for)"
    )
    .in("month_plan_id", monthPlanIds)
    .in("system_id", allowedSystemIds)
    .order("planned_for", { ascending: true })
    .order("source_due_date", { ascending: true });

  if (options.objectId) {
    query = query.eq("object_id", options.objectId);
  }

  const { data, error } = await query;
  if (error) throw error;

  return (data ?? []) as Array<{
    id: string;
    object_id: string;
    month_plan_id: string;
    system_id: string;
    equipment_id: string;
    template_id: string;
    planned_for: string;
    source_due_date: string;
    is_overdue: boolean;
    is_carried_over: boolean;
    task_id: string | null;
    status: "pending" | "materialized" | "carried_over" | "closed" | "cancelled";
    month_plan: { plan_month: string } | Array<{ plan_month: string }> | null;
    equipment:
      | {
          name: string;
          inventory_no: string;
          room:
            | {
                name: string;
                floor: string | null;
                floor_ref: { name: string; sort_order: number } | Array<{ name: string; sort_order: number }> | null;
                room_type: { name: string } | Array<{ name: string }> | null;
              }
            | Array<{
                name: string;
                floor: string | null;
                floor_ref: { name: string; sort_order: number } | Array<{ name: string; sort_order: number }> | null;
                room_type: { name: string } | Array<{ name: string }> | null;
              }>
            | null;
        }
      | Array<{
          name: string;
          inventory_no: string;
          room:
            | {
                name: string;
                floor: string | null;
                floor_ref: { name: string; sort_order: number } | Array<{ name: string; sort_order: number }> | null;
                room_type: { name: string } | Array<{ name: string }> | null;
              }
            | Array<{
                name: string;
                floor: string | null;
                floor_ref: { name: string; sort_order: number } | Array<{ name: string; sort_order: number }> | null;
                room_type: { name: string } | Array<{ name: string }> | null;
              }>
            | null;
        }>
      | null;
    template: { name: string; norm_hours: number | null } | Array<{ name: string; norm_hours: number | null }> | null;
    system: { name: string } | Array<{ name: string }> | null;
    object: { name: string } | Array<{ name: string }> | null;
    task:
      | { id: string; status: "new" | "in_progress" | "on_hold" | "done" | "closed" | "cancelled"; planned_for: string }
      | Array<{ id: string; status: "new" | "in_progress" | "on_hold" | "done" | "closed" | "cancelled"; planned_for: string }>
      | null;
  }>;
}

export async function getPprMonthPlanItemForProfile(
  supabase: SupabaseClient,
  profile: Pick<Profile, "id" | "role">,
  itemId: string
) {
  assertPprCalendarQueryAccess(profile.role);
  const { data, error } = await supabase
    .from("ppr_month_plan_items")
    .select("id,object_id,month_plan_id,system_id,planned_for,source_due_date,status,task_id,month_plan:ppr_month_plans(plan_month)")
    .eq("id", itemId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const systems = await listPprCalendarSystemsForProfile(supabase, profile);
  if (!systems.some((item) => item.id === data.system_id)) {
    return null;
  }

  return data as {
    id: string;
    object_id: string;
    month_plan_id: string;
    system_id: string;
    planned_for: string;
    source_due_date: string;
    status: "pending" | "materialized" | "carried_over" | "closed" | "cancelled";
    task_id: string | null;
    month_plan: { plan_month: string } | Array<{ plan_month: string }> | null;
  };
}
