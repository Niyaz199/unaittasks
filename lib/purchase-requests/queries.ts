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
  created_at: string;
  stock_item: { name: string; unit: string } | Array<{ name: string; unit: string }> | null;
};

export type PurchaseRequestRow = {
  id: string;
  object_id: string;
  status: "new" | "in_progress" | "fulfilled" | "cancelled";
  source: "manual" | "low_stock";
  description: string | null;
  requested_by: string;
  assigned_to: string | null;
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
      "id,object_id,status,source,description,requested_by,assigned_to,created_at,updated_at,fulfilled_at,cancelled_at,object:objects(name),requester:profiles!purchase_requests_requested_by_fkey(full_name),assignee:profiles!purchase_requests_assigned_to_fkey(full_name),items:purchase_request_items(id,request_id,object_id,stock_item_id,title,unit,quantity_requested,note,is_auto_generated,created_at,stock_item:stock_items(name,unit))"
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
