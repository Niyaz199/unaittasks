import type { SupabaseClient } from "@supabase/supabase-js";
import { listActorScopedObjectsForProfile } from "@/lib/access/object-scope";
import { isGlobalObjectScopeRole } from "@/lib/access/matrix";
import {
  canAccessPurchaseRequestsModule,
  canCreatePurchaseRequests,
  canManagePurchaseRequests,
} from "@/lib/capabilities";
import type { Profile } from "@/lib/types";

type NamedRelation = { name: string } | Array<{ name: string }> | null;
type UserRelation = { full_name: string } | Array<{ full_name: string }> | null;

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
  created_at: string;
  stock_item: { name: string; unit: string; sku?: string | null; kind?: string; procurement_method?: string | null } | Array<{ name: string; unit: string; sku?: string | null; kind?: string; procurement_method?: string | null }> | null;
};

export type PurchaseRequestRow = {
  id: string;
  object_id: string;
  status: "new" | "in_progress" | "fulfilled" | "cancelled";
  source: "manual" | "warehouse_daily";
  request_kind: "draft" | "final";
  executor_role: "engineer" | "procurement_manager" | null;
  description: string | null;
  requested_by: string | null;
  assigned_to: string | null;
  draft_date: string | null;
  origin_request_id: string | null;
  processed_at: string | null;
  approved_by: string | null;
  created_at: string;
  updated_at: string;
  fulfilled_at: string | null;
  cancelled_at: string | null;
  object: NamedRelation;
  requester: UserRelation;
  assignee: UserRelation;
  items: PurchaseRequestItemRow[] | null;
};

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
  options: { objectId?: string; status?: PurchaseRequestRow["status"] | "all" } = {}
) {
  if (!canAccessPurchaseRequestsModule(profile.role)) {
    throw new Error("Недостаточно прав для чтения заявок на закупку");
  }

  const objects = await listPurchaseRequestReadableObjectsForProfile(supabase, profile);
  if (!objects.length && !isGlobalObjectScopeRole(profile.role)) return [];

  let query = supabase
    .from("purchase_requests")
    .select(
      "id,object_id,status,source,request_kind,executor_role,description,requested_by,assigned_to,draft_date,origin_request_id,processed_at,approved_by,created_at,updated_at,fulfilled_at,cancelled_at,object:objects(name),requester:profiles!purchase_requests_requested_by_fkey(full_name),assignee:profiles!purchase_requests_assigned_to_fkey(full_name),items:purchase_request_items(id,request_id,object_id,stock_item_id,title,unit,quantity_requested,note,is_auto_generated,assigned_role,current_qty_snapshot,min_qty_snapshot,storage_location_id,location_name_snapshot,characteristics,in_cart,cart_marked_at,created_at,stock_item:stock_items(name,unit,sku,kind,procurement_method))"
    )
    .order("created_at", { ascending: false });

  if (options.objectId) {
    query = query.eq("object_id", options.objectId);
  }
  if (options.status && options.status !== "all") {
    query = query.eq("status", options.status);
  }

  const { data, error } =
    isGlobalObjectScopeRole(profile.role) ? await query : await query.in("object_id", objects.map((item) => item.id));
  if (error) throw error;
  return (data ?? []) as PurchaseRequestRow[];
}
