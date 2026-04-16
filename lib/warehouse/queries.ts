import type { SupabaseClient } from "@supabase/supabase-js";
import { listActorScopedObjectsForProfile, hasActorScopedObjectAccessForProfile } from "@/lib/access/object-scope";
import { isGlobalObjectScopeRole } from "@/lib/access/matrix";
import { canAccessWarehouseModule, canManageWarehouseCatalog } from "@/lib/capabilities";
import type { Profile } from "@/lib/types";

type NamedRelation = { name: string } | Array<{ name: string }> | null;
type StockLocationRelation = { id: string; name: string } | Array<{ id: string; name: string }> | null;
type SystemRelation = { id: string; name: string } | Array<{ id: string; name: string }> | null;
type RoomRelation = { id: string; name: string } | Array<{ id: string; name: string }> | null;
type SystemGroupRelation = { id: string; name: string; code: string } | Array<{ id: string; name: string; code: string }> | null;

export type StockItemSystemGroupLinkRow = {
  id: string;
  object_id: string;
  stock_item_id: string;
  system_group_id: string;
  created_at: string;
  system_group: SystemGroupRelation;
};

export type StockItemRow = {
  id: string;
  object_id: string;
  name: string;
  kind: "zip" | "component";
  is_spare_part: boolean;
  procurement_method: "engineer" | "procurement";
  unit: string;
  sku: string | null;
  min_qty: number;
  current_qty: number;
  storage_location_id: string | null;
  comment: string | null;
  is_active: boolean;
  created_at: string;
  object: NamedRelation;
  storage_location: StockLocationRelation;
  system_group_links: StockItemSystemGroupLinkRow[] | null;
};

export type StockLocationRow = {
  id: string;
  object_id: string;
  system_id: string | null;
  room_id: string | null;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  object: NamedRelation;
  system: SystemRelation;
  room: RoomRelation;
};

export type StockLocationQrCode = {
  id: string;
  object_id: string;
  location_id: string;
  qr_token: string;
  is_active: boolean;
  generated_at: string;
};

export type WarehouseObjectSummaryRow = {
  object_id: string;
  object_name: string;
  item_count: number;
  active_item_count: number;
  location_count: number;
  low_stock_count: number;
};

export type StockBalanceRow = {
  id: string;
  object_id: string;
  item_id: string;
  location_id: string;
  qty: number;
  updated_at: string;
  item: {
    id: string;
    name: string;
    kind: StockItemRow["kind"];
    unit: string;
    min_qty: number;
    current_qty: number;
    is_active: boolean;
  } | Array<{
    id: string;
    name: string;
    kind: StockItemRow["kind"];
    unit: string;
    min_qty: number;
    current_qty: number;
    is_active: boolean;
  }> | null;
};

export type StockMovementRow = {
  id: string;
  object_id: string;
  item_id: string;
  location_id: string;
  movement_type: "receipt" | "issue" | "adjustment_in" | "adjustment_out";
  quantity: number;
  note: string | null;
  actor_id: string;
  created_at: string;
  actor: { full_name: string } | Array<{ full_name: string }> | null;
  item: { name: string; unit: string } | Array<{ name: string; unit: string }> | null;
};

export type EquipmentComponentRow = {
  id: string;
  object_id: string;
  equipment_id: string;
  stock_item_id: string;
  quantity: number;
  reserve_qty: number;
  is_critical: boolean;
  note: string | null;
  created_at: string;
  stock_item:
    | {
        id: string;
        name: string;
        kind: StockItemRow["kind"];
        unit: string;
        min_qty: number;
        current_qty: number;
      }
    | Array<{
        id: string;
        name: string;
        kind: StockItemRow["kind"];
        unit: string;
        min_qty: number;
        current_qty: number;
      }>
    | null;
};

async function listWarehouseScopedObjects(
  supabase: SupabaseClient,
  profile: Pick<Profile, "id" | "role">
) {
  return listActorScopedObjectsForProfile(supabase, profile);
}

export async function listWarehouseReadableObjectsForProfile(
  supabase: SupabaseClient,
  profile: Pick<Profile, "id" | "role">
) {
  if (!canAccessWarehouseModule(profile.role)) {
    throw new Error("Недостаточно прав для чтения склада");
  }

  return listWarehouseScopedObjects(supabase, profile);
}

export async function listWarehouseManageableObjectsForProfile(
  supabase: SupabaseClient,
  profile: Pick<Profile, "id" | "role">
) {
  if (!canManageWarehouseCatalog(profile.role)) {
    throw new Error("Недостаточно прав для управления складом");
  }

  return listWarehouseScopedObjects(supabase, profile);
}

export async function listWarehouseObjectSummariesForProfile(
  supabase: SupabaseClient,
  profile: Pick<Profile, "id" | "role">
) {
  if (!canAccessWarehouseModule(profile.role)) {
    throw new Error("Недостаточно прав для чтения склада");
  }

  const objects = await listWarehouseReadableObjectsForProfile(supabase, profile);
  if (!objects.length) return [];

  const objectIds = objects.map((item) => item.id);
  const [{ data: items, error: itemsError }, { data: locations, error: locationsError }] = await Promise.all([
    supabase.from("stock_items").select("object_id,current_qty,min_qty,is_active").in("object_id", objectIds),
    supabase.from("stock_locations").select("object_id,is_active").in("object_id", objectIds),
  ]);
  if (itemsError) throw itemsError;
  if (locationsError) throw locationsError;

  const itemStats = new Map<
    string,
    { item_count: number; active_item_count: number; low_stock_count: number }
  >();
  for (const row of items ?? []) {
    const current = itemStats.get(row.object_id) ?? { item_count: 0, active_item_count: 0, low_stock_count: 0 };
    current.item_count += 1;
    if (row.is_active) current.active_item_count += 1;
    if (row.current_qty < row.min_qty) current.low_stock_count += 1;
    itemStats.set(row.object_id, current);
  }

  const locationStats = new Map<string, number>();
  for (const row of locations ?? []) {
    locationStats.set(row.object_id, (locationStats.get(row.object_id) ?? 0) + 1);
  }

  return objects
    .map((object) => {
      const itemSummary = itemStats.get(object.id);
      return {
        object_id: object.id,
        object_name: object.name,
        item_count: itemSummary?.item_count ?? 0,
        active_item_count: itemSummary?.active_item_count ?? 0,
        location_count: locationStats.get(object.id) ?? 0,
        low_stock_count: itemSummary?.low_stock_count ?? 0,
      };
    })
    .sort((a, b) => a.object_name.localeCompare(b.object_name, "ru"));
}

export async function listStockItemsForProfile(
  supabase: SupabaseClient,
  profile: Pick<Profile, "id" | "role">,
  options: { objectId?: string; lowStockOnly?: boolean } = {}
) {
  if (!canAccessWarehouseModule(profile.role)) {
    throw new Error("Недостаточно прав для чтения ТМЦ");
  }

  const objects = await listWarehouseReadableObjectsForProfile(supabase, profile);
  if (!objects.length && !isGlobalObjectScopeRole(profile.role)) return [];

  let query = supabase
    .from("stock_items")
    .select(
      "id,object_id,name,kind,is_spare_part,procurement_method,unit,sku,min_qty,current_qty,storage_location_id,comment,is_active,created_at,object:objects(name),storage_location:stock_locations(id,name),system_group_links:stock_item_system_groups(id,object_id,stock_item_id,system_group_id,created_at,system_group:ppr_system_groups(id,name,code))"
    )
    .order("name", { ascending: true });

  if (options.objectId) {
    query = query.eq("object_id", options.objectId);
  }

  const { data, error } =
    isGlobalObjectScopeRole(profile.role) ? await query : await query.in("object_id", objects.map((item) => item.id));
  if (error) throw error;

  const rows = (data ?? []) as StockItemRow[];
  return options.lowStockOnly ? rows.filter((row) => row.current_qty <= row.min_qty) : rows;
}

export async function listStockItemOptionsForProfile(
  supabase: SupabaseClient,
  profile: Pick<Profile, "id" | "role">,
  options: { objectId?: string; includeInactive?: boolean } = {}
) {
  const rows = await listStockItemsForProfile(supabase, profile, { objectId: options.objectId });
  return rows.filter((row) => options.includeInactive || row.is_active);
}

export async function listStockLocationsForProfile(
  supabase: SupabaseClient,
  profile: Pick<Profile, "id" | "role">,
  options: { objectId?: string } = {}
) {
  if (!canAccessWarehouseModule(profile.role)) {
    throw new Error("Недостаточно прав для чтения мест хранения");
  }

  const objects = await listWarehouseReadableObjectsForProfile(supabase, profile);
  if (!objects.length && !isGlobalObjectScopeRole(profile.role)) return [];

  let query = supabase
    .from("stock_locations")
    .select("id,object_id,system_id,room_id,name,description,is_active,created_at,object:objects(name),system:ppr_systems(id,name),room:object_rooms(id,name)")
    .order("name", { ascending: true });

  if (options.objectId) {
    query = query.eq("object_id", options.objectId);
  }

  const { data, error } =
    isGlobalObjectScopeRole(profile.role) ? await query : await query.in("object_id", objects.map((item) => item.id));
  if (error) throw error;
  return (data ?? []) as StockLocationRow[];
}

export async function getStockLocationByIdForProfile(
  supabase: SupabaseClient,
  profile: Pick<Profile, "id" | "role">,
  locationId: string
) {
  if (!canAccessWarehouseModule(profile.role)) {
    throw new Error("Недостаточно прав для чтения места хранения");
  }

  const { data: location, error } = await supabase
    .from("stock_locations")
    .select("id,object_id,system_id,room_id,name,description,is_active,created_at,object:objects(name),system:ppr_systems(id,name),room:object_rooms(id,name)")
    .eq("id", locationId)
    .maybeSingle();
  if (error) throw error;
  if (!location) return null;

  const canAccess =
    isGlobalObjectScopeRole(profile.role) ||
    (await hasActorScopedObjectAccessForProfile(supabase, profile, location.object_id));
  if (!canAccess) return null;

  const [{ data: qrCode, error: qrError }, { data: balances, error: balancesError }, { data: movements, error: movementsError }] =
    await Promise.all([
      supabase
        .from("stock_location_qr_codes")
        .select("id,object_id,location_id,qr_token,is_active,generated_at")
        .eq("location_id", locationId)
        .eq("is_active", true)
        .maybeSingle(),
      supabase
        .from("stock_balances")
        .select(
          "id,object_id,item_id,location_id,qty,updated_at,item:stock_items(id,name,kind,unit,min_qty,current_qty,is_active)"
        )
        .eq("location_id", locationId)
        .order("updated_at", { ascending: false }),
      supabase
        .from("stock_movements")
        .select(
          "id,object_id,item_id,location_id,movement_type,quantity,note,actor_id,created_at,actor:profiles(full_name),item:stock_items(name,unit)"
        )
        .eq("location_id", locationId)
        .order("created_at", { ascending: false })
        .limit(20),
    ]);

  if (qrError) throw qrError;
  if (balancesError) throw balancesError;
  if (movementsError) throw movementsError;

  return {
    location: location as StockLocationRow,
    qrCode: (qrCode ?? null) as StockLocationQrCode | null,
    balances: (balances ?? []) as StockBalanceRow[],
    movements: (movements ?? []) as StockMovementRow[],
  };
}

export async function getStockLocationQrCodeByTokenForProfile(
  supabase: SupabaseClient,
  profile: Pick<Profile, "role">,
  qrToken: string
) {
  if (!canAccessWarehouseModule(profile.role)) {
    throw new Error("Недостаточно прав для QR склада");
  }

  const { data, error } = await supabase.rpc("stock_location_resolve_qr_token", { _token: qrToken.trim() });
  if (error) throw error;

  const row = Array.isArray(data) ? data[0] ?? null : data ?? null;
  return row as StockLocationQrCode | null;
}

export async function regenerateStockLocationQrCodeForProfile(
  supabase: SupabaseClient,
  profile: Pick<Profile, "id" | "role">,
  locationId: string
) {
  if (!canManageWarehouseCatalog(profile.role)) {
    throw new Error("Недостаточно прав для регенерации QR места хранения");
  }

  const { data: location, error: locationError } = await supabase
    .from("stock_locations")
    .select("id,object_id")
    .eq("id", locationId)
    .maybeSingle();
  if (locationError) throw locationError;
  if (!location) {
    throw new Error("Место хранения не найдено");
  }

  const canManage =
    isGlobalObjectScopeRole(profile.role) ||
    (await hasActorScopedObjectAccessForProfile(supabase, profile, location.object_id));
  if (!canManage) {
    throw new Error("Место хранения недоступно для регенерации QR");
  }

  const { data, error } = await supabase.rpc("stock_location_regenerate_qr", { _location_id: locationId });
  if (error) throw error;

  const row = Array.isArray(data) ? data[0] ?? null : data ?? null;
  return row as StockLocationQrCode | null;
}

export async function listEquipmentComponentsForProfile(
  supabase: SupabaseClient,
  profile: Pick<Profile, "id" | "role">,
  equipmentId: string
) {
  if (!canAccessWarehouseModule(profile.role)) {
    throw new Error("Недостаточно прав для чтения состава оборудования");
  }

  const { data: equipment, error: equipmentError } = await supabase
    .from("ppr_equipment")
    .select("id,object_id")
    .eq("id", equipmentId)
    .maybeSingle();
  if (equipmentError) throw equipmentError;
  if (!equipment) return [];

  const canAccess =
    isGlobalObjectScopeRole(profile.role) ||
    (await hasActorScopedObjectAccessForProfile(supabase, profile, equipment.object_id));
  if (!canAccess) return [];

  const { data, error } = await supabase
    .from("ppr_equipment_components")
    .select(
      "id,object_id,equipment_id,stock_item_id,quantity,reserve_qty,is_critical,note,created_at,stock_item:stock_items(id,name,kind,unit,min_qty,current_qty)"
    )
    .eq("equipment_id", equipmentId)
    .order("created_at", { ascending: true });
  if (error) throw error;

  return (data ?? []) as EquipmentComponentRow[];
}
