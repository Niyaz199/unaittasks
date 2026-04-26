
import { notFound } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { canManageWarehouseCatalog } from "@/lib/capabilities";
import { listPprSystemGroups, listPprWorkTemplatesForWarehouse } from "@/lib/ppr/structure-queries";
import { canAccessPprStructureScreens, getPprEquipmentByIdForProfile } from "@/lib/ppr/queries";
import { listEquipmentComponentsForProfile, listStockItemOptionsForProfile, listStockLocationsForProfile } from "@/lib/warehouse/queries";
import { listObjectRoomsForProfile } from "@/lib/object-rooms";
import { canManagePprStructure } from "@/lib/ppr/permissions";
import { listPprActorAccessibleObjectIds } from "@/lib/ppr/task-lifecycle";
import { PageHeader } from "@/components/ui/page-header";
import { BackButton } from "@/components/ui/back-button";
import { PprEquipmentDetails } from "@/components/ppr/equipment/ppr-equipment-details";

export default async function PprEquipmentDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { profile } = await requireProfile();
  if (!canAccessPprStructureScreens(profile.role)) {
    return <div className="empty-state">Доступ к оборудованию ППР запрещён.</div>;
  }

  const supabase = await createSupabaseServerClient();
  const details = await getPprEquipmentByIdForProfile(supabase, profile, id).catch(() => null);
  if (!details) notFound();
  const canManageComponents = canManageWarehouseCatalog(profile.role);

  const accessibleObjectIds = await listPprActorAccessibleObjectIds(supabase, profile);
  const canClone = canManagePprStructure(
    { id: profile.id, role: profile.role, accessibleObjectIds },
    details.equipment.object_id
  );

  const [components, stockItems, locations, systemGroups, pprTemplates, cloneRoomsRaw, assignmentsCountRes] = await Promise.all([
    listEquipmentComponentsForProfile(supabase, profile, id),
    listStockItemOptionsForProfile(supabase, profile, {
      objectId: details.equipment.object_id,
      includeInactive: true,
    }),
    canManageComponents ? listStockLocationsForProfile(supabase, profile, { objectId: details.equipment.object_id }) : Promise.resolve([]),
    canManageComponents ? listPprSystemGroups(supabase, profile) : Promise.resolve([]),
    canManageComponents
      ? listPprWorkTemplatesForWarehouse(supabase, { objectId: details.equipment.object_id })
      : Promise.resolve([]),
    canClone
      ? listObjectRoomsForProfile(supabase, profile, { objectId: details.equipment.object_id })
      : Promise.resolve([]),
    canClone
      ? supabase
          .from("ppr_equipment_work_assignments")
          .select("id", { count: "exact", head: true })
          .eq("equipment_id", id)
      : Promise.resolve({ count: 0 } as { count: number | null }),
  ]);

  const cloneAssignmentsCount = (assignmentsCountRes as { count: number | null }).count ?? 0;
  const cloneRooms = cloneRoomsRaw.map((room) => {
    const floorRef = Array.isArray(room.floor_ref) ? room.floor_ref[0] ?? null : room.floor_ref;
    return {
      id: room.id,
      name: room.name,
      floor_label: floorRef?.name ?? (room.floor != null ? `Этаж ${room.floor}` : null),
    };
  });

  return (
    <section className="grid">
      <PageHeader
        title="Карточка оборудования"
        description="Карточка оборудования ППР с деталями по структуре, активным QR и fallback-точкой для QR-entry."
        actions={<BackButton fallback="/ppr/equipment" />}
      />

      <PprEquipmentDetails
        equipment={details.equipment}
        qrCode={details.qrCode}
        components={components}
        stockItems={stockItems.map((item) => ({
          id: item.id,
          name: item.name,
          kind: item.kind,
          unit: item.unit,
          min_qty: item.min_qty,
          current_qty: item.current_qty,
          sku: item.sku,
          manufacturer: item.manufacturer,
          model: item.model,
          is_spare_part: item.is_spare_part,
          is_active: item.is_active,
          storage_location_name: (Array.isArray(item.storage_location) ? item.storage_location[0]?.name : item.storage_location?.name) ?? null,
        }))}
        storageLocations={locations.map((item) => ({
          id: item.id,
          object_id: item.object_id,
          name: item.name,
          is_active: item.is_active,
        }))}
        systemGroups={systemGroups}
        pprTemplates={pprTemplates.map((t) => ({
          id: t.id,
          name: t.name,
          object_id: t.object_id,
          system_id: t.system_id,
          system_group_id: t.system_group_id,
        }))}
        cloneRooms={cloneRooms}
        cloneAssignmentsCount={cloneAssignmentsCount}
        canClone={canClone}
        canManageComponents={canManageComponents}
      />
    </section>
  );
}
