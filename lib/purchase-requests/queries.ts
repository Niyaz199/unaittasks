import type { SupabaseClient } from "@supabase/supabase-js";
import { listActorScopedObjectsForProfile } from "@/lib/access/object-scope";
import { isGlobalObjectScopeRole } from "@/lib/access/matrix";
import {
  canAccessPurchaseRequestsModule,
  canCreatePurchaseRequests,
  canManagePurchaseRequests,
} from "@/lib/capabilities";
import type { Profile, PurchaseRequestStatus } from "@/lib/types";

type NamedRelation = { name: string } | Array<{ name: string }> | null;
type UserRelation = { full_name: string } | Array<{ full_name: string }> | null;
type PurchaseRequestBaseRow = {
  id: string;
  object_id: string;
  status: PurchaseRequestStatus;
  source: "manual" | "warehouse_daily" | "ppr";
  request_kind: "draft" | "final";
  executor_role: "engineer" | "procurement_manager" | null;
  description: string | null;
  requested_by: string | null;
  assigned_to: string | null;
  draft_date: string | null;
  origin_request_id: string | null;
  processed_at: string | null;
  approved_by: string | null;
  ppr_plan_month: string | null;
  created_at: string;
  updated_at: string;
  fulfilled_at: string | null;
  cancelled_at: string | null;
  object: NamedRelation;
  requester: UserRelation;
  assignee: UserRelation;
};
type PurchaseRequestPreviewItemRow = {
  request_id: string;
  title: string;
};

export type PurchaseRequestItemRow = {
  id: string;
  request_id: string;
  object_id: string;
  stock_item_id: string | null;
  title: string;
  unit: string;
  quantity_requested: number;
  note: string | null;
  is_auto_generated: boolean;
  assigned_role: "engineer" | "procurement_manager" | null;
  current_qty_snapshot: number | null;
  min_qty_snapshot: number | null;
  storage_location_id: string | null;
  location_name_snapshot: string | null;
  characteristics: string | null;
  in_cart: boolean;
  cart_marked_at: string | null;
  ppr_system_id: string | null;
  created_at: string;
  stock_item: { name: string; unit: string; sku?: string | null; kind?: string; procurement_method?: string | null } | Array<{ name: string; unit: string; sku?: string | null; kind?: string; procurement_method?: string | null }> | null;
  ppr_system: { name: string } | Array<{ name: string }> | null;
};

export type PurchaseRequestSummaryRow = PurchaseRequestBaseRow & {
  item_count: number;
  preview_items: string[];
};

export type PurchaseRequestDetailRow = PurchaseRequestBaseRow & {
  items: PurchaseRequestItemRow[] | null;
};

export type PurchaseRequestArchiveMode = "active" | "archived";
export type PurchaseRequestFlow = "engineer_requests" | "warehouse_daily" | "ppr";

const purchaseRequestSummarySelect =
  "id,object_id,status,source,request_kind,executor_role,description,requested_by,assigned_to,draft_date,origin_request_id,processed_at,approved_by,ppr_plan_month,created_at,updated_at,fulfilled_at,cancelled_at,object:objects(name),requester:profiles!purchase_requests_requested_by_fkey(full_name),assignee:profiles!purchase_requests_assigned_to_fkey(full_name)";

const purchaseRequestDetailSelect =
  "id,object_id,status,source,request_kind,executor_role,description,requested_by,assigned_to,draft_date,origin_request_id,processed_at,approved_by,ppr_plan_month,created_at,updated_at,fulfilled_at,cancelled_at,object:objects(name),requester:profiles!purchase_requests_requested_by_fkey(full_name),assignee:profiles!purchase_requests_assigned_to_fkey(full_name),items:purchase_request_items(id,request_id,object_id,stock_item_id,title,unit,quantity_requested,note,is_auto_generated,assigned_role,current_qty_snapshot,min_qty_snapshot,storage_location_id,location_name_snapshot,characteristics,in_cart,cart_marked_at,ppr_system_id,created_at,stock_item:stock_items(name,unit,sku,kind,procurement_method),ppr_system:ppr_systems(name))";

function usesOwnPurchaseRequestScope(role: Profile["role"]) {
  return role === "engineer" || role === "tech";
}

function buildPurchaseRequestSummaryQuery(supabase: SupabaseClient) {
  return supabase.from("purchase_requests").select(purchaseRequestSummarySelect).order("created_at", { ascending: false });
}

function buildPurchaseRequestDetailQuery(supabase: SupabaseClient) {
  return supabase.from("purchase_requests").select(purchaseRequestDetailSelect).order("created_at", { ascending: false });
}

function applyPurchaseRequestReadScope(
  query: ReturnType<typeof buildPurchaseRequestSummaryQuery> | ReturnType<typeof buildPurchaseRequestDetailQuery>,
  profile: Pick<Profile, "id" | "role">,
  objectIds: string[]
) {
  if (profile.role === "procurement_manager" || isGlobalObjectScopeRole(profile.role)) {
    return query;
  }
  if (usesOwnPurchaseRequestScope(profile.role)) {
    return query.eq("requested_by", profile.id);
  }
  return query.in("object_id", objectIds);
}

function normalizeRequestRows(
  rows: PurchaseRequestBaseRow[],
  previewRows: PurchaseRequestPreviewItemRow[]
): PurchaseRequestSummaryRow[] {
  const previewByRequestId = new Map<string, { count: number; titles: string[] }>();
  for (const row of previewRows) {
    const current = previewByRequestId.get(row.request_id) ?? { count: 0, titles: [] };
    current.count += 1;
    if (current.titles.length < 3) {
      current.titles.push(row.title);
    }
    previewByRequestId.set(row.request_id, current);
  }

  return rows.map((row) => {
    const preview = previewByRequestId.get(row.id);
    return {
      ...row,
      item_count: preview?.count ?? 0,
      preview_items: preview?.titles ?? [],
    };
  });
}

export function canReadPurchaseRequests(role: Profile["role"]) {
  return canAccessPurchaseRequestsModule(role);
}

export async function listPurchaseRequestReadableObjectsForProfile(
  supabase: SupabaseClient,
  profile: Pick<Profile, "id" | "role">
) {
  if (!canAccessPurchaseRequestsModule(profile.role)) {
    throw new Error("Недостаточно прав для чтения закупок");
  }

  if (profile.role === "procurement_manager") {
    const { data, error } = await supabase
      .from("purchase_requests")
      .select("object_id,object:objects(name)")
      .order("created_at", { ascending: false });
    if (error) throw error;

    const byId = new Map<string, { id: string; name: string }>();
    for (const row of (data ?? []) as Array<{ object_id: string; object: NamedRelation }>) {
      const relation = Array.isArray(row.object) ? row.object[0] ?? null : row.object;
      byId.set(row.object_id, { id: row.object_id, name: relation?.name ?? "—" });
    }
    return [...byId.values()].sort((left, right) => left.name.localeCompare(right.name, "ru"));
  }

  if (usesOwnPurchaseRequestScope(profile.role)) {
    const { data, error } = await supabase
      .from("purchase_requests")
      .select("object_id,object:objects(name)")
      .eq("requested_by", profile.id)
      .order("created_at", { ascending: false });
    if (error) throw error;

    const byId = new Map<string, { id: string; name: string }>();
    for (const row of (data ?? []) as Array<{ object_id: string; object: NamedRelation }>) {
      const relation = Array.isArray(row.object) ? row.object[0] ?? null : row.object;
      byId.set(row.object_id, { id: row.object_id, name: relation?.name ?? "—" });
    }
    return [...byId.values()].sort((left, right) => left.name.localeCompare(right.name, "ru"));
  }

  return listActorScopedObjectsForProfile(supabase, profile);
}

export async function listPurchaseRequestCreatableObjectsForProfile(
  supabase: SupabaseClient,
  profile: Pick<Profile, "id" | "role">
) {
  if (!canCreatePurchaseRequests(profile.role)) {
    throw new Error("Недостаточно прав для создания закупок");
  }

  return listActorScopedObjectsForProfile(supabase, profile);
}

export async function listManageablePurchaseRequestObjectsForProfile(
  supabase: SupabaseClient,
  profile: Pick<Profile, "id" | "role">
) {
  if (!canManagePurchaseRequests(profile.role)) {
    throw new Error("Недостаточно прав для управления закупками");
  }

  if (profile.role === "procurement_manager") {
    return listPurchaseRequestReadableObjectsForProfile(supabase, profile);
  }

  return listActorScopedObjectsForProfile(supabase, profile);
}

export async function listPurchaseRequestsForProfile(
  supabase: SupabaseClient,
  profile: Pick<Profile, "id" | "role">,
  options: { objectId?: string; archiveMode?: PurchaseRequestArchiveMode } = {}
) {
  if (!canAccessPurchaseRequestsModule(profile.role)) {
    throw new Error("Недостаточно прав для чтения заявок на закупку");
  }

  const objects = await listPurchaseRequestReadableObjectsForProfile(supabase, profile);
  const objectIds = objects.map((item) => item.id);
  if (!objectIds.length && profile.role !== "procurement_manager" && !isGlobalObjectScopeRole(profile.role) && !usesOwnPurchaseRequestScope(profile.role)) {
    return [];
  }

  const archiveMode = options.archiveMode ?? "active";
  const applyCommonFilters = (
    query: ReturnType<typeof buildPurchaseRequestSummaryQuery>
  ) => {
    let scopedQuery = applyPurchaseRequestReadScope(query, profile, objectIds);
    if (options.objectId) {
      scopedQuery = scopedQuery.eq("object_id", options.objectId);
    }
    return scopedQuery;
  };

  let rows: PurchaseRequestBaseRow[] = [];

  if (archiveMode === "archived") {
    const archivedQuery = applyCommonFilters(buildPurchaseRequestSummaryQuery(supabase))
      .eq("request_kind", "final")
      .in("status", ["fulfilled", "cancelled"]);
    const { data, error } = await archivedQuery;
    if (error) throw error;
    rows = (data ?? []) as PurchaseRequestBaseRow[];
  } else {
    const [manualFinalsResult, dailyDraftsResult, dailyFinalsResult, pprFinalsResult] = await Promise.all([
      applyCommonFilters(buildPurchaseRequestSummaryQuery(supabase))
        .eq("source", "manual")
        .in("status", ["new", "in_progress"]),
      applyCommonFilters(buildPurchaseRequestSummaryQuery(supabase))
        .eq("source", "warehouse_daily")
        .eq("request_kind", "draft")
        .is("processed_at", null),
      applyCommonFilters(buildPurchaseRequestSummaryQuery(supabase))
        .eq("source", "warehouse_daily")
        .eq("request_kind", "final")
        .in("status", ["new", "in_progress"]),
      applyCommonFilters(buildPurchaseRequestSummaryQuery(supabase))
        .eq("source", "ppr")
        .in("status", ["new", "in_progress"]),
    ]);

    if (manualFinalsResult.error) throw manualFinalsResult.error;
    if (dailyDraftsResult.error) throw dailyDraftsResult.error;
    if (dailyFinalsResult.error) throw dailyFinalsResult.error;
    if (pprFinalsResult.error) throw pprFinalsResult.error;

    rows = [
      ...((manualFinalsResult.data ?? []) as PurchaseRequestBaseRow[]),
      ...((dailyDraftsResult.data ?? []) as PurchaseRequestBaseRow[]),
      ...((dailyFinalsResult.data ?? []) as PurchaseRequestBaseRow[]),
      ...((pprFinalsResult.data ?? []) as PurchaseRequestBaseRow[]),
    ].sort((left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime());
  }

  if (!rows.length) return [];

  const { data: previewItems, error: previewError } = await supabase
    .from("purchase_request_items")
    .select("request_id,title")
    .in("request_id", rows.map((row) => row.id))
    .order("created_at", { ascending: true });
  if (previewError) throw previewError;

  return normalizeRequestRows(rows, (previewItems ?? []) as PurchaseRequestPreviewItemRow[]);
}

export async function getPurchaseRequestByIdForProfile(
  supabase: SupabaseClient,
  profile: Pick<Profile, "id" | "role">,
  requestId: string
) {
  if (!canAccessPurchaseRequestsModule(profile.role)) {
    throw new Error("Недостаточно прав для чтения заявки на закупку");
  }

  const objects =
    profile.role === "procurement_manager" || isGlobalObjectScopeRole(profile.role) || usesOwnPurchaseRequestScope(profile.role)
      ? []
      : await listPurchaseRequestReadableObjectsForProfile(supabase, profile);
  const objectIds = objects.map((item) => item.id);
  if (!objectIds.length && profile.role !== "procurement_manager" && !isGlobalObjectScopeRole(profile.role) && !usesOwnPurchaseRequestScope(profile.role)) {
    return null;
  }

  const query = applyPurchaseRequestReadScope(buildPurchaseRequestDetailQuery(supabase), profile, objectIds).eq("id", requestId);
  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  return (data ?? null) as PurchaseRequestDetailRow | null;
}
