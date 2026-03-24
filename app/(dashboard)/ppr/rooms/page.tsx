import { requireProfile } from "@/lib/auth";
import { listFloorsForProfile } from "@/lib/floors";
import { listRoomTypesForProfile } from "@/lib/room-types";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { listObjectRoomManageableObjectsForProfile, listObjectRoomsForProfile } from "@/lib/object-rooms";
import { canAccessPprStructureScreens } from "@/lib/ppr/queries";
import { PageHeader } from "@/components/ui/page-header";
import { BackButton } from "@/components/ui/back-button";
import { PprRoomsAdmin } from "@/components/ppr/rooms/ppr-rooms-admin";

export default async function PprRoomsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const search = searchParams ? await searchParams : {};
  const { profile } = await requireProfile();
  if (!canAccessPprStructureScreens(profile.role)) {
    return <div className="empty-state">Доступ к структуре ППР запрещён.</div>;
  }

  const supabase = await createSupabaseServerClient();
  const [objects, rooms, floors, roomTypes] = await Promise.all([
    listObjectRoomManageableObjectsForProfile(supabase, profile),
    listObjectRoomsForProfile(supabase, profile),
    listFloorsForProfile(supabase, profile),
    listRoomTypesForProfile(supabase, profile),
  ]);

  const initialObjectId = typeof search.objectId === "string" ? search.objectId : "";
  const initialFloorId = typeof search.floorId === "string" ? search.floorId : "";

  return (
    <section className="grid">
      <PageHeader
        title="Помещения объектов"
        description="Общий справочник помещений с собственными карточками и постоянными QR-кодами; участие в обходах настраивается отдельно."
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
