import type { SupabaseClient } from "@supabase/supabase-js";
import { listActorScopedObjectsForProfile, hasActorScopedObjectAccessForProfile } from "@/lib/access/object-scope";
import { isGlobalObjectScopeRole } from "@/lib/access/matrix";
import { canAccessWarehouseModule, canManageWarehouseCatalog } from "@/lib/capabilities";
import type { Profile } from "@/lib/types";
import { getStockItemSignedUrls } from "@/lib/warehouse/stock-item-files";

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

export type StockItemPprTemplateLinkRow = {
  id: string;
  object_id: string;
  stock_item_id: string;
  template_id: string;
  required_qty: number;
  created_at: string;
  template: { id: string; name: string; system_id: string } | Array<{ id: string; name: string; system_id: string }> | null;
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
  manufacturer: string | null;
  model: string | null;
  description: string | null;
  min_qty: number;
  current_qty: number;
  storage_location_id: string | null;
  comment: string | null;
  is_active: boolean;
  created_at: string;
  object: NamedRelation;
  storage_location: StockLocationRelation;
  system_group_links: StockItemSystemGroupLinkRow[] | null;
  ppr_template_links: StockItemPprTemplateLinkRow[] | null;
};

export type StockItemAttachmentRow = {
  id: string;
  object_id: string;
  stock_item_id: string;
  storage_path: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  uploaded_by: string | null;
  created_at: string;
};

export type StockItemAttachmentWithUrl = StockItemAttachmentRow & { url: string | null };

export type StockItemUsageRow = {
  equipment_id: string;
  equipment_name: string;
  inventory_no: string | null;
  object_id: string;
  object_name: string | null;
  system_id: string | null;
  system_name: string | null;
  quantity: number;
  reserve_qty: number;
  is_critical: boolean;
};

export type StockItemDetails = {
  item: StockItemRow;
  balances: StockBalanceRow[];
  movements: StockMovementRow[];
  usage: StockItemUsageRow[];
  attachments: StockItemAttachmentWithUrl[];
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
  location?:
    | { id: string; name: string }
    | Array<{ id: string; name: string }>
    | null;
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
      "id,object_id,name,kind,is_spare_part,procurement_method,unit,sku,manufacturer,model,description,min_qty,current_qty,storage_location_id,comment,is_active,created_at,object:objects(name),storage_location:stock_locations(id,name),system_group_links:stock_item_system_groups(id,object_id,stock_item_id,system_group_id,created_at,system_group:ppr_system_groups(id,name,code)),ppr_template_links:stock_item_ppr_templates(id,object_id,stock_item_id,template_id,required_qty,created_at,template:ppr_work_templates(id,name,system_id))"
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

export async function getStockItemByIdForProfile(
  supabase: SupabaseClient,
  profile: Pick<Profile, "id" | "role">,
  stockItemId: string
): Promise<StockItemDetails | null> {
  if (!canAccessWarehouseModule(profile.role)) {
    throw new Error("Недостаточно прав для чтения ТМЦ");
  }

  const { data: item, error } = await supabase
    .from("stock_items")
    .select(
      "id,object_id,name,kind,is_spare_part,procurement_method,unit,sku,manufacturer,model,description,min_qty,current_qty,storage_location_id,comment,is_active,created_at,object:objects(name),storage_location:stock_locations(id,name),system_group_links:stock_item_system_groups(id,object_id,stock_item_id,system_group_id,created_at,system_group:ppr_system_groups(id,name,code)),ppr_template_links:stock_item_ppr_templates(id,object_id,stock_item_id,template_id,required_qty,created_at,template:ppr_work_templates(id,name,system_id))"
    )
    .eq("id", stockItemId)
    .maybeSingle();
  if (error) throw error;
  if (!item) return null;

  const canAccess =
    isGlobalObjectScopeRole(profile.role) ||
    (await hasActorScopedObjectAccessForProfile(supabase, profile, item.object_id));
  if (!canAccess) return null;

  const [balancesRes, movementsRes, componentsRes, attachmentsRes] = await Promise.all([
    supabase
      .from("stock_balances")
      .select(
        "id,object_id,item_id,location_id,qty,updated_at,item:stock_items(id,name,kind,unit,min_qty,current_qty,is_active),location:stock_locations(id,name)"
      )
      .eq("item_id", stockItemId)
      .order("updated_at", { ascending: false }),
    supabase
      .from("stock_movements")
      .select(
        "id,object_id,item_id,location_id,movement_type,quantity,note,actor_id,created_at,actor:profiles(full_name),item:stock_items(name,unit)"
      )
      .eq("item_id", stockItemId)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("ppr_equipment_components")
      .select(
        "equipment_id,object_id,quantity,reserve_qty,is_critical,equipment:ppr_equipment(id,name,inventory_no,system_id,object_id,system:ppr_systems(id,name),object:objects(name))"
      )
      .eq("stock_item_id", stockItemId),
    supabase
      .from("stock_item_attachments")
      .select("id,object_id,stock_item_id,storage_path,file_name,mime_type,size_bytes,uploaded_by,created_at")
      .eq("stock_item_id", stockItemId)
      .order("created_at", { ascending: false }),
  ]);

  if (balancesRes.error) throw balancesRes.error;
  if (movementsRes.error) throw movementsRes.error;
  if (componentsRes.error) throw componentsRes.error;
  if (attachmentsRes.error) throw attachmentsRes.error;

  const usage: StockItemUsageRow[] = ((componentsRes.data ?? []) as unknown as Array<{
    equipment_id: string;
    object_id: string;
    quantity: number;
    reserve_qty: number;
    is_critical: boolean;
    equipment:
      | {
          id: string;
          name: string;
          inventory_no: string | null;
          system_id: string | null;
          system: { id: string; name: string } | Array<{ id: string; name: string }> | null;
          object: { name: string } | Array<{ name: string }> | null;
        }
      | Array<{
          id: string;
          name: string;
          inventory_no: string | null;
          system_id: string | null;
          system: { id: string; name: string } | Array<{ id: string; name: string }> | null;
          object: { name: string } | Array<{ name: string }> | null;
        }>
      | null;
  }>).map((row) => {
    const eq = Array.isArray(row.equipment) ? row.equipment[0] : row.equipment;
    const system = eq ? (Array.isArray(eq.system) ? eq.system[0] : eq.system) : null;
    const object = eq ? (Array.isArray(eq.object) ? eq.object[0] : eq.object) : null;
    return {
      equipment_id: row.equipment_id,
      equipment_name: eq?.name ?? "—",
      inventory_no: eq?.inventory_no ?? null,
      object_id: row.object_id,
      object_name: object?.name ?? null,
      system_id: system?.id ?? null,
      system_name: system?.name ?? null,
      quantity: row.quantity,
      reserve_qty: row.reserve_qty,
      is_critical: row.is_critical,
    };
  });

  const rawAttachments = (attachmentsRes.data ?? []) as StockItemAttachmentRow[];
  const signed = await getStockItemSignedUrls(
    supabase,
    rawAttachments.map((item) => item.storage_path)
  );
  const attachments: StockItemAttachmentWithUrl[] = rawAttachments.map((row) => ({
    ...row,
    url: signed[row.storage_path] ?? null,
  }));

  return {
    item: item as StockItemRow,
    balances: (balancesRes.data ?? []) as StockBalanceRow[],
    movements: (movementsRes.data ?? []) as StockMovementRow[],
    usage,
    attachments,
  };
}

export type StockLocationsObjectSummaryRow = {
  object_id: string;
  object_name: string;
  total_count: number;
  active_count: number;
  with_qr_count: number;
};

export async function listStockLocationsObjectSummariesForProfile(
  supabase: SupabaseClient,
  profile: Pick<Profile, "id" | "role">
): Promise<StockLocationsObjectSummaryRow[]> {
  const objects = await listWarehouseReadableObjectsForProfile(supabase, profile);
  if (!objects.length) return [];

  const objectIds = objects.map((item) => item.id);
  const { data: locations, error: locationsError } = await supabase
    .from("stock_locations")
    .select("id,object_id,is_active")
    .in("object_id", objectIds);
  if (locationsError) throw locationsError;

  const locationRows = (locations ?? []) as Array<{ id: string; object_id: string; is_active: boolean }>;

  const stats = new Map<string, { total: number; active: number; withQr: number }>();
  for (const row of locationRows) {
    const current = stats.get(row.object_id) ?? { total: 0, active: 0, withQr: 0 };
    current.total += 1;
    if (row.is_active) current.active += 1;
    stats.set(row.object_id, current);
  }

  const locationIdToObject = new Map(locationRows.map((row) => [row.id, row.object_id] as const));
  if (locationIdToObject.size) {
    const { data: qrCodes, error: qrError } = await supabase
      .from("stock_location_qr_codes")
      .select("location_id")
      .eq("is_active", true)
      .in("location_id", Array.from(locationIdToObject.keys()));
    if (qrError) throw qrError;

    const countedLocations = new Set<string>();
    for (const row of (qrCodes ?? []) as Array<{ location_id: string }>) {
      if (countedLocations.has(row.location_id)) continue;
      countedLocations.add(row.location_id);
      const objectId = locationIdToObject.get(row.location_id);
      if (!objectId) continue;
      const current = stats.get(objectId) ?? { total: 0, active: 0, withQr: 0 };
      current.withQr += 1;
      stats.set(objectId, current);
    }
  }

  return objects
    .map((object) => {
      const s = stats.get(object.id);
      return {
        object_id: object.id,
        object_name: object.name,
        total_count: s?.total ?? 0,
        active_count: s?.active ?? 0,
        with_qr_count: s?.withQr ?? 0,
      };
    })
    .sort((a, b) => a.object_name.localeCompare(b.object_name, "ru"));
}
