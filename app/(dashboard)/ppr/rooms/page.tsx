import { requireProfile } from "@/lib/auth";
import { listFloorsForProfile } from "@/lib/floors";
import { listRoomTypesForProfile } from "@/lib/room-types";
import {
  canReadObjectRooms,
  listObjectRoomManageableObjectsForProfile,
  listObjectRoomsForProfile,
  listObjectRoomsObjectSummariesForProfile,
} from "@/lib/object-rooms";
import { PageHeader } from "@/components/ui/page-header";
import { BackButton } from "@/components/ui/back-button";
import { PprRoomsAdmin } from "@/components/ppr/rooms/ppr-rooms-admin";
import { PprRoomsObjectHub } from "@/components/ppr/rooms/ppr-rooms-object-hub";

export default async function PprRoomsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const search = searchParams ? await searchParams : {};
  const { profile, supabase } = await requireProfile();
  if (!canReadObjectRooms(profile.role)) {
    return <div className="empty-state">Доступ к справочнику помещений запрещен.</div>;
  }

  const objects = await listObjectRoomManageableObjectsForProfile(supabase, profile);
  const requestedObjectId = typeof search.objectId === "string" ? search.objectId : "";
  const selectedObjectId = objects.some((item) => item.id === requestedObjectId) ? requestedObjectId : "";
  const shouldShowCatalog = Boolean(selectedObjectId);
  const initialFloorId = typeof search.floorId === "string" ? search.floorId : "";

  const [rooms, floors, roomTypes, summaries] = await Promise.all([
    shouldShowCatalog ? listObjectRoomsForProfile(supabase, profile, { objectId: selectedObjectId }) : Promise.resolve([]),
    shouldShowCatalog ? listFloorsForProfile(supabase, profile, { objectId: selectedObjectId }) : Promise.resolve([]),
    shouldShowCatalog ? listRoomTypesForProfile(supabase, profile) : Promise.resolve([]),
    shouldShowCatalog ? Promise.resolve([]) : listObjectRoomsObjectSummariesForProfile(supabase, profile),
  ]);

  const objectName = objects.find((o) => o.id === selectedObjectId)?.name ?? "";
  const description = shouldShowCatalog
    ? `«${objectName}»: помещения с QR-кодами и карточками.`
    : "Выберите объект, чтобы открыть его помещения.";

  return (
    <section className="grid">
      <PageHeader
        title="Помещения объектов"
        description={description}
        actions={<BackButton fallback="/ppr" label="← Назад к ППР" />}
      />

      {shouldShowCatalog ? (
        <PprRoomsAdmin
          rooms={rooms}
          objects={objects}
          floors={floors.map((item) => ({
            id: item.id,
            object_id: item.object_id,
            name: item.name,
            sort_order: item.sort_order,
            is_active: item.is_active,
          }))}
          roomTypes={roomTypes.map((item) => ({
            id: item.id,
            name: item.name,
            sort_order: item.sort_order,
            is_active: item.is_active,
          }))}
          initialFilterObjectId={selectedObjectId}
          initialFilterFloorId={initialFloorId}
          initialCreateOpen={search.new === "1"}
        />
      ) : (
        <PprRoomsObjectHub summaries={summaries} />
      )}
    </section>
  );
}
