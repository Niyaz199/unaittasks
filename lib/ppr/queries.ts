import type { SupabaseClient } from "@supabase/supabase-js";
import { listObjectRoomsForProfile } from "@/lib/object-rooms";
import type { Profile } from "@/lib/types";
import { canAssignExecutorToPprTask } from "@/lib/ppr/permissions";
import type { PprTaskAttachment, PprTaskComment } from "@/lib/ppr/types";

const STRUCTURE_MANAGER_ROLES = new Set(["admin", "chief", "lead", "object_engineer"]);
const SYSTEM_GROUP_MANAGER_ROLES = new Set(["admin", "chief", "lead"]);
const TEMPLATE_MANAGER_ROLES = new Set(["admin", "chief", "lead", "object_engineer"]);
const ASSIGNMENT_MANAGER_ROLES = new Set(["admin", "chief", "lead", "object_engineer"]);
const CALENDAR_MANAGER_ROLES = new Set(["admin", "chief", "lead", "engineer", "object_engineer"]);
const TASK_LAYER_ROLES = new Set(["admin", "chief", "lead", "engineer", "object_engineer", "tech"]);
const QR_LAYER_ROLES = new Set(["admin", "chief", "lead", "engineer", "object_engineer", "tech"]);
const RESPONSIBLE_ROLES = new Set(["lead", "engineer", "object_engineer"]);

type ObjectRow = { id: string; name: string };

type PprCalendarRawTemplateRelation = { norm_hours: number | null } | Array<{ norm_hours: number | null }> | null;

function unwrapRelation<T>(value: T | T[] | null | undefined) {
  return Array.isArray(value) ? (value[0] ?? null) : (value ?? null);
}

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

function assertPprStructureQueryAccess(role: Profile["role"]) {
  if (!canAccessPprStructureScreens(role)) {
    throw new Error("Недостаточно прав для server-side запросов структуры ППР");
  }
}

function assertPprSystemGroupQueryAccess(role: Profile["role"]) {
  if (!canAccessPprSystemGroupScreens(role)) {
    throw new Error("Недостаточно прав для server-side запросов справочника групп систем ППР");
  }
}

function assertPprTemplateQueryAccess(role: Profile["role"]) {
  if (!canAccessPprTemplateScreens(role)) {
    throw new Error("Недостаточно прав для server-side запросов шаблонов ППР");
  }
}

function assertPprAssignmentQueryAccess(role: Profile["role"]) {
  if (!canAccessPprAssignmentScreens(role)) {
    throw new Error("Недостаточно прав для server-side запросов назначений ППР");
  }
}

function assertPprCalendarQueryAccess(role: Profile["role"]) {
  if (!canAccessPprCalendarScreens(role)) {
    throw new Error("Недостаточно прав для server-side запросов календаря ППР");
  }
}

function assertPprTaskQueryAccess(role: Profile["role"]) {
  if (!canAccessPprTaskScreens(role)) {
    throw new Error("Недостаточно прав для server-side запросов ППР-заявок");
  }
}

function assertPprQrQueryAccess(role: Profile["role"]) {
  if (!canAccessPprQrScreens(role)) {
    throw new Error("Недостаточно прав для QR-запросов ППР");
  }
}

export function canAccessPprStructureScreens(role: Profile["role"]) {
  return STRUCTURE_MANAGER_ROLES.has(role);
}

export function canAccessPprSystemGroupScreens(role: Profile["role"]) {
  return SYSTEM_GROUP_MANAGER_ROLES.has(role);
}

export function canAccessPprTemplateScreens(role: Profile["role"]) {
  return TEMPLATE_MANAGER_ROLES.has(role);
}

export function canAccessPprAssignmentScreens(role: Profile["role"]) {
  return ASSIGNMENT_MANAGER_ROLES.has(role);
}

export function canAccessPprCalendarScreens(role: Profile["role"]) {
  return CALENDAR_MANAGER_ROLES.has(role);
}

export function canAccessPprTaskScreens(role: Profile["role"]) {
  return TASK_LAYER_ROLES.has(role);
}

export function canAccessPprQrScreens(role: Profile["role"]) {
  return QR_LAYER_ROLES.has(role);
}

export async function listPprManageableObjectsForProfile(
  supabase: SupabaseClient,
  profile: Pick<Profile, "id" | "role">
): Promise<ObjectRow[]> {
  assertPprStructureQueryAccess(profile.role);

  if (profile.role === "admin" || profile.role === "chief") {
    const { data, error } = await supabase.from("objects").select("id,name").order("name", { ascending: true });
    if (error) throw error;
    return (data ?? []) as ObjectRow[];
  }

  if (profile.role !== "lead" && profile.role !== "object_engineer") {
    return [];
  }

  type UserObjectRow = { objects: ObjectRow | null };
  const { data, error } = await supabase
    .from("user_objects")
    .select("objects(id,name)")
    .eq("user_id", profile.id);
  if (error) throw error;

  const rows = ((data ?? []) as unknown as UserObjectRow[])
    .map((row) => row.objects)
    .filter((row): row is ObjectRow => row !== null);

  return rows.sort((a, b) => a.name.localeCompare(b.name, "ru"));
}

export async function listPprSystemGroups(
  supabase: SupabaseClient,
  profile: Pick<Profile, "role">
) {
  assertPprStructureQueryAccess(profile.role);
  const { data, error } = await supabase
    .from("ppr_system_groups")
    .select("id,name,code,is_active")
    .order("name", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Array<{ id: string; name: string; code: string; is_active: boolean }>;
}

export async function listPprSystemGroupsForManagement(
  supabase: SupabaseClient,
  profile: Pick<Profile, "role">
) {
  assertPprSystemGroupQueryAccess(profile.role);
  return listPprSystemGroups(supabase, profile);
}

export async function listPprResponsibleCandidates(
  supabase: SupabaseClient,
  objectIds: string[]
): Promise<Array<{ id: string; full_name: string; role: "lead" | "engineer" | "object_engineer"; object_ids: string[] }>> {
  if (!objectIds.length) return [];

  const { data: links, error: linksError } = await supabase
    .from("user_objects")
    .select("user_id,object_id")
    .in("object_id", objectIds);
  if (linksError) throw linksError;

  const candidateIds = [...new Set((links ?? []).map((row) => row.user_id))];
  if (!candidateIds.length) return [];

  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("id,full_name,role")
    .in("id", candidateIds)
    .in("role", [...RESPONSIBLE_ROLES])
    .order("full_name", { ascending: true });
  if (profilesError) throw profilesError;

  const objectIdsByUser = new Map<string, string[]>();
  for (const link of links ?? []) {
    const current = objectIdsByUser.get(link.user_id) ?? [];
    if (!current.includes(link.object_id)) current.push(link.object_id);
    objectIdsByUser.set(link.user_id, current);
  }

  return ((profiles ?? []) as Array<{ id: string; full_name: string; role: "lead" | "engineer" | "object_engineer" }>).map(
    (profileRow) => ({
      ...profileRow,
      object_ids: objectIdsByUser.get(profileRow.id) ?? [],
    })
  );
}

export async function listPprSystemsForProfile(supabase: SupabaseClient, profile: Pick<Profile, "id" | "role">) {
  assertPprStructureQueryAccess(profile.role);
  const objects = await listPprManageableObjectsForProfile(supabase, profile);
  if (!objects.length && profile.role !== "admin" && profile.role !== "chief") return [];

  const query = supabase
    .from("ppr_systems")
    .select(
      "id,object_id,system_group_id,name,description,responsible_user_id,is_active,created_at,object:objects(name),system_group:ppr_system_groups(name),responsible:profiles(full_name,role)"
    )
    .order("name", { ascending: true });

  const { data, error } =
    profile.role === "admin" || profile.role === "chief" ? await query : await query.in("object_id", objects.map((item) => item.id));
  if (error) throw error;
  return (data ?? []) as Array<{
    id: string;
    object_id: string;
    system_group_id: string;
    name: string;
    description: string | null;
    responsible_user_id: string | null;
    is_active: boolean;
    created_at: string;
    object: { name: string } | Array<{ name: string }> | null;
    system_group: { name: string } | Array<{ name: string }> | null;
    responsible: { full_name: string; role: string } | Array<{ full_name: string; role: string }> | null;
  }>;
}

export async function listPprRoomsForProfile(supabase: SupabaseClient, profile: Pick<Profile, "id" | "role">) {
  assertPprStructureQueryAccess(profile.role);
  return listObjectRoomsForProfile(supabase, profile);
}

export async function listPprEquipmentForProfile(supabase: SupabaseClient, profile: Pick<Profile, "id" | "role">) {
  assertPprStructureQueryAccess(profile.role);
  const objects = await listPprManageableObjectsForProfile(supabase, profile);
  if (!objects.length && profile.role !== "admin" && profile.role !== "chief") return [];

  const query = supabase
    .from("ppr_equipment")
    .select(
      "id,object_id,system_id,room_id,inventory_no,name,dispatch_name,service_start_date,status,serial_no,manufacturer,model,description,comment,created_at,object:objects(name),system:ppr_systems(name),room:object_rooms(name)"
    )
    .order("created_at", { ascending: false });

  const { data, error } =
    profile.role === "admin" || profile.role === "chief" ? await query : await query.in("object_id", objects.map((item) => item.id));
  if (error) throw error;

  return (data ?? []) as Array<{
    id: string;
    object_id: string;
    system_id: string;
    room_id: string;
    inventory_no: string;
    name: string;
    dispatch_name: string;
    service_start_date: string;
    status: "active" | "repair" | "out_of_service" | "archived";
    serial_no: string | null;
    manufacturer: string | null;
    model: string | null;
    description: string | null;
    comment: string | null;
    created_at: string;
    object: { name: string } | Array<{ name: string }> | null;
    system: { name: string } | Array<{ name: string }> | null;
    room: { name: string } | Array<{ name: string }> | null;
  }>;
}

export async function getPprEquipmentByIdForProfile(
  supabase: SupabaseClient,
  profile: Pick<Profile, "id" | "role">,
  equipmentId: string
) {
  assertPprStructureQueryAccess(profile.role);

  const { data, error } = await supabase
    .from("ppr_equipment")
    .select(
      "id,object_id,system_id,room_id,inventory_no,name,dispatch_name,service_start_date,status,serial_no,manufacturer,model,description,comment,created_at,object:objects(name),system:ppr_systems(name),room:object_rooms(name)"
    )
    .eq("id", equipmentId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const manageableObjects = await listPprManageableObjectsForProfile(supabase, profile);
  const canAccess =
    profile.role === "admin" || profile.role === "chief" || manageableObjects.some((item) => item.id === data.object_id);
  if (!canAccess) return null;

  const { data: qrCode, error: qrError } = await supabase
    .from("ppr_equipment_qr_codes")
    .select("id,object_id,equipment_id,qr_token,is_active,generated_at")
    .eq("equipment_id", equipmentId)
    .eq("is_active", true)
    .maybeSingle();
  if (qrError) throw qrError;

  return {
    equipment: data as {
      id: string;
      object_id: string;
      system_id: string;
      room_id: string;
      inventory_no: string;
      name: string;
      dispatch_name: string;
      service_start_date: string;
      status: "active" | "repair" | "out_of_service" | "archived";
      serial_no: string | null;
      manufacturer: string | null;
      model: string | null;
      description: string | null;
      comment: string | null;
      created_at: string;
      object: { name: string } | Array<{ name: string }> | null;
      system: { name: string } | Array<{ name: string }> | null;
      room: { name: string } | Array<{ name: string }> | null;
    },
    qrCode: (qrCode ?? null) as
      | {
          id: string;
          object_id: string;
          equipment_id: string;
          qr_token: string;
          is_active: boolean;
          generated_at: string;
        }
      | null,
  };
}

export async function getPprEquipmentQrCodeByToken(
  supabase: SupabaseClient,
  profile: Pick<Profile, "role">,
  qrToken: string
) {
  assertPprQrQueryAccess(profile.role);

  const { data, error } = await supabase.rpc("ppr_resolve_qr_token", { _token: qrToken });
  if (error) throw error;

  const row = Array.isArray(data) ? data[0] ?? null : data ?? null;
  return row as
    | {
        id: string;
        object_id: string;
        equipment_id: string;
        qr_token: string;
        is_active: boolean;
        generated_at: string;
      }
    | null;
}

export async function listPprWorkTemplatesForProfile(supabase: SupabaseClient, profile: Pick<Profile, "id" | "role">) {
  assertPprTemplateQueryAccess(profile.role);
  const objects = await listPprManageableObjectsForProfile(supabase, profile);
  if (!objects.length && profile.role !== "admin" && profile.role !== "chief") return [];

  const query = supabase
    .from("ppr_work_templates")
    .select(
      "id,object_id,system_id,name,description,period_months,base_start_date,norm_hours,methodology,is_active,created_at,object:objects(name),system:ppr_systems(name)"
    )
    .order("created_at", { ascending: false });

  const { data, error } =
    profile.role === "admin" || profile.role === "chief" ? await query : await query.in("object_id", objects.map((item) => item.id));
  if (error) throw error;

  return (data ?? []) as Array<{
    id: string;
    object_id: string;
    system_id: string;
    name: string;
    description: string | null;
    period_months: number;
    base_start_date: string;
    norm_hours: number | null;
    methodology: string | null;
    is_active: boolean;
    created_at: string;
    object: { name: string } | Array<{ name: string }> | null;
    system: { name: string } | Array<{ name: string }> | null;
  }>;
}

export async function getPprWorkTemplateByIdForProfile(
  supabase: SupabaseClient,
  profile: Pick<Profile, "id" | "role">,
  templateId: string
) {
  assertPprTemplateQueryAccess(profile.role);

  const { data: template, error: templateError } = await supabase
    .from("ppr_work_templates")
    .select(
      "id,object_id,system_id,name,description,period_months,base_start_date,norm_hours,methodology,is_active,created_at,object:objects(name),system:ppr_systems(name)"
    )
    .eq("id", templateId)
    .maybeSingle();
  if (templateError) throw templateError;
  if (!template) return null;

  const manageableObjects = await listPprManageableObjectsForProfile(supabase, profile);
  const canAccess =
    profile.role === "admin" || profile.role === "chief" || manageableObjects.some((item) => item.id === template.object_id);
  if (!canAccess) return null;

  const { data: checklistItems, error: checklistError } = await supabase
    .from("ppr_work_checklist_items")
    .select("id,object_id,template_id,sort_order,title,description")
    .eq("template_id", templateId)
    .order("sort_order", { ascending: true });
  if (checklistError) throw checklistError;

  return {
    template: template as {
      id: string;
      object_id: string;
      system_id: string;
      name: string;
      description: string | null;
      period_months: number;
      base_start_date: string;
      norm_hours: number | null;
      methodology: string | null;
      is_active: boolean;
      created_at: string;
      object: { name: string } | Array<{ name: string }> | null;
      system: { name: string } | Array<{ name: string }> | null;
    },
    checklistItems: (checklistItems ?? []) as Array<{
      id: string;
      object_id: string;
      template_id: string;
      sort_order: number;
      title: string;
      description: string | null;
    }>,
  };
}

export async function listPprAssignmentsForProfile(supabase: SupabaseClient, profile: Pick<Profile, "id" | "role">) {
  assertPprAssignmentQueryAccess(profile.role);
  const objects = await listPprManageableObjectsForProfile(supabase, profile);
  if (!objects.length && profile.role !== "admin" && profile.role !== "chief") return [];

  const query = supabase
    .from("ppr_equipment_work_assignments")
    .select(
      "id,object_id,equipment_id,template_id,start_date,period_months,is_active,created_at,equipment:ppr_equipment(name,inventory_no,system_id),template:ppr_work_templates(name,system_id),object:objects(name)"
    )
    .order("created_at", { ascending: false });

  const { data, error } =
    profile.role === "admin" || profile.role === "chief" ? await query : await query.in("object_id", objects.map((item) => item.id));
  if (error) throw error;

  return (data ?? []) as Array<{
    id: string;
    object_id: string;
    equipment_id: string;
    template_id: string;
    start_date: string;
    period_months: number;
    is_active: boolean;
    created_at: string;
    equipment:
      | { name: string; inventory_no: string; system_id: string }
      | Array<{ name: string; inventory_no: string; system_id: string }>
      | null;
    template: { name: string; system_id: string } | Array<{ name: string; system_id: string }> | null;
    object: { name: string } | Array<{ name: string }> | null;
  }>;
}

export async function listAssignableEquipmentForProfile(supabase: SupabaseClient, profile: Pick<Profile, "id" | "role">) {
  assertPprAssignmentQueryAccess(profile.role);
  const objects = await listPprManageableObjectsForProfile(supabase, profile);
  if (!objects.length && profile.role !== "admin" && profile.role !== "chief") return [];

  const query = supabase
    .from("ppr_equipment")
    .select("id,object_id,system_id,name,inventory_no")
    .order("name", { ascending: true });

  const { data, error } =
    profile.role === "admin" || profile.role === "chief" ? await query : await query.in("object_id", objects.map((item) => item.id));
  if (error) throw error;

  return (data ?? []) as Array<{
    id: string;
    object_id: string;
    system_id: string;
    name: string;
    inventory_no: string;
  }>;
}

export async function listAssignableTemplatesForProfile(supabase: SupabaseClient, profile: Pick<Profile, "id" | "role">) {
  assertPprAssignmentQueryAccess(profile.role);
  const objects = await listPprManageableObjectsForProfile(supabase, profile);
  if (!objects.length && profile.role !== "admin" && profile.role !== "chief") return [];

  const query = supabase
    .from("ppr_work_templates")
    .select("id,object_id,system_id,name,period_months,base_start_date,is_active")
    .order("name", { ascending: true });

  const { data, error } =
    profile.role === "admin" || profile.role === "chief" ? await query : await query.in("object_id", objects.map((item) => item.id));
  if (error) throw error;

  return (data ?? []) as Array<{
    id: string;
    object_id: string;
    system_id: string;
    name: string;
    period_months: number;
    base_start_date: string;
    is_active: boolean;
  }>;
}

export async function listPprCalendarSystemsForProfile(supabase: SupabaseClient, profile: Pick<Profile, "id" | "role">) {
  assertPprCalendarQueryAccess(profile.role);

  const baseQuery = supabase
    .from("ppr_systems")
    .select("id,object_id,system_group_id,name,responsible_user_id,object:objects(name),system_group:ppr_system_groups(name,code)")
    .order("name", { ascending: true });

  if (profile.role === "admin" || profile.role === "chief") {
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

  if (profile.role === "engineer") {
    const { data, error } = await baseQuery.eq("responsible_user_id", profile.id);
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

  const manageableObjects = await listPprManageableObjectsForProfile(supabase, profile);
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

async function listPprCalendarYearRowsForSystems(
  supabase: SupabaseClient,
  systemIds: string[],
  year: number
) {
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
  options: { planMonth: string; systemId?: string; objectId?: string }
) {
  assertPprCalendarQueryAccess(profile.role);
  const systems = await listPprCalendarSystemsForProfile(supabase, profile);
  const allowedSystemIds = systems.map((item) => item.id);
  if (!allowedSystemIds.length) return [];

  const query = supabase
    .from("ppr_month_plans")
    .select("id,object_id,system_id,plan_month,generated_at,object:objects(name),system:ppr_systems(name)")
    .eq("plan_month", options.planMonth)
    .order("generated_at", { ascending: false });

  const scopedQuery = options.systemId ? query.eq("system_id", options.systemId) : query.in("system_id", allowedSystemIds);
  const objectScopedQuery = options.objectId ? scopedQuery.eq("object_id", options.objectId) : scopedQuery;
  const { data, error } = await objectScopedQuery;
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
  options: { planMonth: string; systemId?: string; objectId?: string }
) {
  assertPprCalendarQueryAccess(profile.role);
  const systems = await listPprCalendarSystemsForProfile(supabase, profile);
  const allowedSystemIds = systems.map((item) => item.id);
  if (!allowedSystemIds.length) return [];

  const query = supabase
    .from("ppr_month_plan_items")
    .select(
      "id,object_id,month_plan_id,system_id,equipment_id,assignment_id,template_id,planned_for,source_due_date,is_overdue,is_carried_over,task_id,status,month_plan:ppr_month_plans(plan_month),equipment:ppr_equipment(name,inventory_no,room:object_rooms(name,floor)),template:ppr_work_templates(name,norm_hours),system:ppr_systems(name),object:objects(name),task:ppr_tasks(id,status,planned_for)"
    )
    .order("planned_for", { ascending: true })
    .order("source_due_date", { ascending: true });

  const scopedQuery = options.systemId ? query.eq("system_id", options.systemId) : query.in("system_id", allowedSystemIds);
  const objectScopedQuery = options.objectId ? scopedQuery.eq("object_id", options.objectId) : scopedQuery;
  const { data, error } = await objectScopedQuery;
  if (error) throw error;

  return ((data ?? []) as Array<{
    id: string;
    object_id: string;
    month_plan_id: string;
    system_id: string;
    equipment_id: string;
    assignment_id: string;
    template_id: string;
    planned_for: string;
    source_due_date: string;
    is_overdue: boolean;
    is_carried_over: boolean;
    task_id: string | null;
    status: "pending" | "materialized" | "carried_over" | "closed" | "cancelled";
    month_plan: { plan_month: string } | Array<{ plan_month: string }> | null;
    equipment:
      | { name: string; inventory_no: string; room: { name: string; floor: string | null } | Array<{ name: string; floor: string | null }> | null }
      | Array<{ name: string; inventory_no: string; room: { name: string; floor: string | null } | Array<{ name: string; floor: string | null }> | null }>
      | null;
    template: { name: string; norm_hours: number | null } | Array<{ name: string; norm_hours: number | null }> | null;
    system: { name: string } | Array<{ name: string }> | null;
    object: { name: string } | Array<{ name: string }> | null;
    task:
      | { id: string; status: "new" | "in_progress" | "done" | "closed" | "cancelled"; planned_for: string }
      | Array<{ id: string; status: "new" | "in_progress" | "done" | "closed" | "cancelled"; planned_for: string }>
      | null;
  }>)
    .filter((item) => {
      const monthPlan = Array.isArray(item.month_plan) ? item.month_plan[0] : item.month_plan;
      return monthPlan?.plan_month === options.planMonth;
    });
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

type PprTaskListKind = "my" | "active" | "archive";
type PprTaskListView = "all" | "review";

export type PprTaskSummaryRow = {
  id: string;
  object_id: string;
  system_id: string;
  equipment_id: string;
  responsible_user_id: string;
  assignee_id: string | null;
  planned_for: string;
  completed_at: string | null;
  closed_at: string | null;
  cancelled_at: string | null;
  cancelled_by: string | null;
  status: "new" | "in_progress" | "done" | "closed" | "cancelled";
  is_overdue: boolean;
  is_rescheduled: boolean;
  general_comment: string | null;
  cancel_reason: string | null;
  created_at: string;
  object: { name: string } | Array<{ name: string }> | null;
  system: { name: string } | Array<{ name: string }> | null;
  equipment: { name: string; inventory_no: string } | Array<{ name: string; inventory_no: string }> | null;
  responsible: { full_name: string } | Array<{ full_name: string }> | null;
  assignee: { full_name: string } | Array<{ full_name: string }> | null;
};

export type PprTaskWorkItemRow = {
  id: string;
  object_id: string;
  task_id: string;
  assignment_id: string;
  template_id: string;
  plan_item_id: string | null;
  title_snapshot: string;
  description_snapshot: string | null;
  methodology_snapshot: string | null;
  checklist_snapshot: Array<{ sort_order: number; title: string; description: string | null }>;
  norm_hours_snapshot: number | null;
  sort_order: number;
};

export type PprTaskAssigneeCandidateRow = {
  id: string;
  full_name: string;
  role: "engineer" | "object_engineer" | "tech";
};

export type PprTaskCommentRow = PprTaskComment & {
  author: { full_name: string } | Array<{ full_name: string }> | null;
};

function buildPprTaskSummaryQuery(supabase: SupabaseClient) {
  return supabase
    .from("ppr_tasks")
    .select(
      "id,object_id,system_id,equipment_id,responsible_user_id,assignee_id,planned_for,completed_at,closed_at,cancelled_at,cancelled_by,status,is_overdue,is_rescheduled,general_comment,cancel_reason,created_at,object:objects(name),system:ppr_systems(name),equipment:ppr_equipment(name,inventory_no),responsible:profiles!ppr_tasks_responsible_user_id_fkey(full_name),assignee:profiles!ppr_tasks_assignee_id_fkey(full_name)"
    )
    .order("planned_for", { ascending: true })
    .order("created_at", { ascending: false });
}

export async function listPprTasksForProfile(
  supabase: SupabaseClient,
  profile: Pick<Profile, "id" | "role">,
  options: { kind?: PprTaskListKind; view?: PprTaskListView } = {}
) {
  assertPprTaskQueryAccess(profile.role);

  const kind = options.kind ?? "active";
  let query = buildPprTaskSummaryQuery(supabase);

  if (kind === "my") {
    query = query.eq("assignee_id", profile.id).neq("status", "closed").neq("status", "cancelled");
  } else if (kind === "archive") {
    query = query.in("status", ["closed", "cancelled"]);
  } else {
    query = query.in("status", ["new", "in_progress", "done"]);
  }

  if (profile.role === "lead" || profile.role === "object_engineer") {
    const objects = await listPprManageableObjectsForProfile(supabase, profile);
    if (!objects.length) return [];
    query = query.in(
      "object_id",
      objects.map((item) => item.id)
    );
  } else if (profile.role === "engineer" && kind !== "my") {
    query = query.or(`responsible_user_id.eq.${profile.id},assignee_id.eq.${profile.id}`);
  } else if (profile.role === "tech" && kind !== "my") {
    query = query.eq("assignee_id", profile.id);
  }

  const { data, error } = await query;
  if (error) throw error;

  const tasks = (data ?? []) as PprTaskSummaryRow[];
  if (kind === "active" && options.view === "review") {
    return tasks.filter((task) => task.status === "done" && task.assignee_id !== task.responsible_user_id);
  }
  return tasks;
}

export async function getPprTaskByIdForProfile(
  supabase: SupabaseClient,
  profile: Pick<Profile, "id" | "role">,
  taskId: string
) {
  assertPprTaskQueryAccess(profile.role);

  const { data, error } = await buildPprTaskSummaryQuery(supabase).eq("id", taskId).maybeSingle();
  if (error) throw error;
  if (!data) return null;

  if (profile.role === "admin" || profile.role === "chief") {
    return data as PprTaskSummaryRow;
  }

  if (profile.role === "lead" || profile.role === "object_engineer") {
    const objects = await listPprManageableObjectsForProfile(supabase, profile);
    if (!objects.some((item) => item.id === data.object_id)) {
      return null;
    }
    return data as PprTaskSummaryRow;
  }

  if (profile.role === "engineer") {
    if (data.responsible_user_id !== profile.id && data.assignee_id !== profile.id) {
      return null;
    }
    return data as PprTaskSummaryRow;
  }

  if (data.assignee_id !== profile.id) {
    return null;
  }
  return data as PprTaskSummaryRow;
}

export async function listPprTaskWorkItemsForProfile(
  supabase: SupabaseClient,
  profile: Pick<Profile, "id" | "role">,
  taskId: string
) {
  const task = await getPprTaskByIdForProfile(supabase, profile, taskId);
  if (!task) {
    return [];
  }

  const { data, error } = await supabase
    .from("ppr_task_work_items")
    .select(
      "id,object_id,task_id,assignment_id,template_id,plan_item_id,title_snapshot,description_snapshot,methodology_snapshot,checklist_snapshot,norm_hours_snapshot,sort_order"
    )
    .eq("task_id", taskId)
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return (data ?? []) as PprTaskWorkItemRow[];
}

export async function listPprTaskCommentsForProfile(
  supabase: SupabaseClient,
  profile: Pick<Profile, "id" | "role">,
  taskId: string
) {
  const task = await getPprTaskByIdForProfile(supabase, profile, taskId);
  if (!task) {
    return [];
  }

  const { data, error } = await supabase
    .from("ppr_task_comments")
    .select("id,object_id,task_id,author_id,body,created_at,author:profiles(full_name)")
    .eq("task_id", taskId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as PprTaskCommentRow[];
}

export async function getPreferredActivePprTaskForEquipmentForProfile(
  supabase: SupabaseClient,
  profile: Pick<Profile, "id" | "role">,
  equipmentId: string
) {
  assertPprQrQueryAccess(profile.role);

  let query = buildPprTaskSummaryQuery(supabase)
    .eq("equipment_id", equipmentId)
    .in("status", ["new", "in_progress", "done"])
    .order("is_overdue", { ascending: false })
    .order("planned_for", { ascending: true })
    .order("created_at", { ascending: false })
    .limit(1);

  if (profile.role === "lead" || profile.role === "object_engineer") {
    const objects = await listPprManageableObjectsForProfile(supabase, profile);
    if (!objects.length) return null;
    query = query.in(
      "object_id",
      objects.map((item) => item.id)
    );
  } else if (profile.role === "engineer") {
    query = query.or(`responsible_user_id.eq.${profile.id},assignee_id.eq.${profile.id}`);
  } else if (profile.role === "tech") {
    query = query.eq("assignee_id", profile.id);
  }

  const { data, error } = await query;
  if (error) throw error;
  return ((data ?? [])[0] ?? null) as PprTaskSummaryRow | null;
}

export async function listPprTaskAttachmentsForProfile(
  supabase: SupabaseClient,
  profile: Pick<Profile, "id" | "role">,
  taskId: string,
  options: { commentId?: string | null } = {}
) {
  const task = await getPprTaskByIdForProfile(supabase, profile, taskId);
  if (!task) {
    return [];
  }

  let query = supabase
    .from("ppr_task_attachments")
    .select("id,object_id,task_id,comment_id,storage_path,file_name,mime_type,size_bytes,uploaded_by,created_at")
    .eq("task_id", taskId)
    .order("created_at", { ascending: true });

  if (options.commentId) {
    query = query.eq("comment_id", options.commentId);
  } else {
    query = query.is("comment_id", null);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as PprTaskAttachment[];
}

export async function getPprTaskCompletionEvidenceForProfile(
  supabase: SupabaseClient,
  profile: Pick<Profile, "id" | "role">,
  taskId: string
) {
  const task = await getPprTaskByIdForProfile(supabase, profile, taskId);
  if (!task) {
    return null;
  }

  const [{ count: commentsCount, error: commentsError }, { count: attachmentsCount, error: attachmentsError }] =
    await Promise.all([
      supabase.from("ppr_task_comments").select("id", { count: "exact", head: true }).eq("task_id", taskId),
      supabase.from("ppr_task_attachments").select("id", { count: "exact", head: true }).eq("task_id", taskId),
    ]);

  if (commentsError) throw commentsError;
  if (attachmentsError) throw attachmentsError;

  return {
    commentsCount: commentsCount ?? 0,
    attachmentsCount: attachmentsCount ?? 0,
  };
}

export async function listPprTaskAssigneeCandidatesForProfile(
  supabase: SupabaseClient,
  profile: Pick<Profile, "id" | "role">,
  taskId: string
) {
  const task = await getPprTaskByIdForProfile(supabase, profile, taskId);
  if (!task) {
    return [];
  }

  const accessibleObjectIds =
    profile.role === "lead" || profile.role === "object_engineer"
      ? (await listPprManageableObjectsForProfile(supabase, profile)).map((item) => item.id)
      : [];
  const canAssign = canAssignExecutorToPprTask(
    { id: profile.id, role: profile.role, accessibleObjectIds },
    { object_id: task.object_id, responsible_user_id: task.responsible_user_id }
  );
  if (!canAssign) {
    return [];
  }

  const { data: links, error: linksError } = await supabase
    .from("user_objects")
    .select("user_id")
    .eq("object_id", task.object_id);
  if (linksError) throw linksError;

  const candidateIds = [...new Set((links ?? []).map((row) => row.user_id))];
  if (!candidateIds.length) {
    return [];
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("id,full_name,role")
    .in("id", candidateIds)
    .in("role", ["engineer", "object_engineer", "tech"])
    .order("full_name", { ascending: true });
  if (error) throw error;

  return (data ?? []) as PprTaskAssigneeCandidateRow[];
}

export async function listMaterializablePlanItemsForRange(
  supabase: SupabaseClient,
  options: { dateFrom: string; dateTo: string }
) {
  const { data, error } = await supabase
    .from("ppr_month_plan_items")
    .select(
      "id,object_id,month_plan_id,system_id,equipment_id,assignment_id,template_id,planned_for,source_due_date,is_overdue,is_carried_over,task_id,status,assignment:ppr_equipment_work_assignments(id),template:ppr_work_templates(id,name,description,methodology,norm_hours),system:ppr_systems(id,responsible_user_id)"
    )
    .in("status", ["pending", "carried_over"])
    .is("task_id", null)
    .gte("planned_for", options.dateFrom)
    .lte("planned_for", options.dateTo)
    .order("planned_for", { ascending: true })
    .order("equipment_id", { ascending: true })
    .order("assignment_id", { ascending: true });
  if (error) throw error;

  return (data ?? []) as Array<{
    id: string;
    object_id: string;
    month_plan_id: string;
    system_id: string;
    equipment_id: string;
    assignment_id: string;
    template_id: string;
    planned_for: string;
    source_due_date: string;
    is_overdue: boolean;
    is_carried_over: boolean;
    task_id: string | null;
    status: "pending" | "carried_over";
    assignment: { id: string } | Array<{ id: string }> | null;
    template:
      | { id: string; name: string; description: string | null; methodology: string | null; norm_hours: number | null }
      | Array<{ id: string; name: string; description: string | null; methodology: string | null; norm_hours: number | null }>
      | null;
    system: { id: string; responsible_user_id: string | null } | Array<{ id: string; responsible_user_id: string | null }> | null;
  }>;
}

export async function getActivePprTaskByAggregation(
  supabase: SupabaseClient,
  options: { equipmentId: string; plannedFor: string }
) {
  const { data, error } = await supabase
    .from("ppr_tasks")
    .select(
      "id,object_id,system_id,equipment_id,responsible_user_id,assignee_id,planned_for,completed_at,closed_at,cancelled_at,cancelled_by,status,is_overdue,is_rescheduled,general_comment,cancel_reason,created_at"
    )
    .eq("equipment_id", options.equipmentId)
    .eq("planned_for", options.plannedFor)
    .in("status", ["new", "in_progress", "done"])
    .maybeSingle();
  if (error) throw error;
  return (data ?? null) as
    | {
        id: string;
        object_id: string;
        system_id: string;
        equipment_id: string;
        responsible_user_id: string;
        assignee_id: string | null;
        planned_for: string;
        completed_at: string | null;
        closed_at: string | null;
        cancelled_at: string | null;
        cancelled_by: string | null;
        status: "new" | "in_progress" | "done";
        is_overdue: boolean;
        is_rescheduled: boolean;
        general_comment: string | null;
        cancel_reason: string | null;
        created_at: string;
      }
    | null;
}
