import { requireProfile } from "@/lib/auth";
import { listObjectRoomsForProfile } from "@/lib/object-rooms";
import {
  canAccessPprStructureScreens,
  listPprEquipmentForProfile,
  listPprManageableObjectsForProfile,
  listPprSystemsForProfile,
} from "@/lib/ppr/queries";
import { listPprEquipmentObjectSummariesForProfile } from "@/lib/ppr/structure-queries";
import { PageHeader } from "@/components/ui/page-header";
import { BackButton } from "@/components/ui/back-button";
import { PprEquipmentAdmin } from "@/components/ppr/equipment/ppr-equipment-admin";
import { PprEquipmentObjectHub } from "@/components/ppr/equipment/ppr-equipment-object-hub";

export default async function PprEquipmentPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const search = searchParams ? await searchParams : {};
  const { profile, supabase } = await requireProfile();
  if (!canAccessPprStructureScreens(profile.role)) {
    return <div className="empty-state">Доступ к оборудованию ППР запрещён.</div>;
  }

  const objects = await listPprManageableObjectsForProfile(supabase, profile);
  const requestedObjectId = typeof search.objectId === "string" ? search.objectId : "";
  const selectedObjectId = objects.some((item) => item.id === requestedObjectId) ? requestedObjectId : "";
  const shouldShowCatalog = Boolean(selectedObjectId);

  const [systems, rooms, equipment, summaries] = await Promise.all([
    shouldShowCatalog ? listPprSystemsForProfile(supabase, profile, { objectId: selectedObjectId }) : Promise.resolve([]),
    shouldShowCatalog ? listObjectRoomsForProfile(supabase, profile, { objectId: selectedObjectId }) : Promise.resolve([]),
    shouldShowCatalog ? listPprEquipmentForProfile(supabase, profile, { objectId: selectedObjectId }) : Promise.resolve([]),
    shouldShowCatalog ? Promise.resolve([]) : listPprEquipmentObjectSummariesForProfile(supabase, profile),
  ]);

  const description = shouldShowCatalog
    ? `Список оборудования объекта «${objects.find((o) => o.id === selectedObjectId)?.name ?? ""}».`
    : "Выберите объект, чтобы просмотреть оборудование, системы и помещения.";

  return (
    <section className="grid">
      <PageHeader
        title="Оборудование ППР"
        description={description}
        actions={<BackButton fallback="/ppr" label="← Назад к ППР" />}
      />

      {shouldShowCatalog ? (
        <PprEquipmentAdmin
          equipment={equipment}
          objects={objects}
          systems={systems.map((item) => ({ id: item.id, object_id: item.object_id, name: item.name }))}
          rooms={rooms.map((item) => ({
            id: item.id,
            object_id: item.object_id,
            name: item.name,
            floor_name: Array.isArray(item.floor_ref) ? item.floor_ref[0]?.name ?? item.floor ?? null : item.floor_ref?.name ?? item.floor ?? null,
            room_type_name: Array.isArray(item.room_type) ? item.room_type[0]?.name ?? null : item.room_type?.name ?? null,
            is_active: item.is_active,
          }))}
          initialFilterObjectId={selectedObjectId}
        />
      ) : (
        <PprEquipmentObjectHub summaries={summaries} />
      )}
    </section>
  );
}
