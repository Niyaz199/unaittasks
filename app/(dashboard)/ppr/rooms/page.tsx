import { requireProfile } from "@/lib/auth";
import { listFloorsForProfile } from "@/lib/floors";
import { listRoomTypesForProfile } from "@/lib/room-types";
import { canReadObjectRooms, listObjectRoomManageableObjectsForProfile, listObjectRoomsForProfile } from "@/lib/object-rooms";
import { PageHeader } from "@/components/ui/page-header";
import { BackButton } from "@/components/ui/back-button";
import { PprRoomsAdmin } from "@/components/ppr/rooms/ppr-rooms-admin";

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
  const initialObjectId = objects.some((item) => item.id === requestedObjectId) ? requestedObjectId : "";
  const initialFloorId = typeof search.floorId === "string" ? search.floorId : "";

  const [rooms, floors, roomTypes] = await Promise.all([
    initialObjectId ? listObjectRoomsForProfile(supabase, profile, { objectId: initialObjectId }) : Promise.resolve([]),
    initialObjectId ? listFloorsForProfile(supabase, profile, { objectId: initialObjectId }) : Promise.resolve([]),
    listRoomTypesForProfile(supabase, profile),
  ]);


  return (
    <section className="grid">
      <PageHeader
        title="Помещения объектов"
        description={initialObjectId ? "Помещения выбранного объекта с QR-кодами и карточками." : "Выберите объект в фильтре ниже, чтобы загрузить список помещений."}
        actions={<BackButton fallback="/ppr" label="← Назад к ППР" />}
      />

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
        initialFilterObjectId={initialObjectId}
        initialFilterFloorId={initialFloorId}
      />
    </section>
  );
}
