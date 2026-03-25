import { requireProfile } from "@/lib/auth";
import { listObjectRoomsForProfile } from "@/lib/object-rooms";
import {
  canAccessPprStructureScreens,
  listPprEquipmentForProfile,
  listPprManageableObjectsForProfile,
  listPprSystemsForProfile,
} from "@/lib/ppr/queries";
import { PageHeader } from "@/components/ui/page-header";
import { BackButton } from "@/components/ui/back-button";
import { PprEquipmentAdmin } from "@/components/ppr/equipment/ppr-equipment-admin";

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

  const [systems, rooms, equipment] = selectedObjectId
    ? await Promise.all([
        listPprSystemsForProfile(supabase, profile, { objectId: selectedObjectId }),
        listObjectRoomsForProfile(supabase, profile, { objectId: selectedObjectId }),
        listPprEquipmentForProfile(supabase, profile, { objectId: selectedObjectId }),
      ])
    : [[], [], []];

  return (
    <section className="grid">
      <PageHeader
        title="Оборудование ППР"
        description="Справочник оборудования с привязкой к объекту, системе и общему справочнику помещений."
        actions={<BackButton fallback="/ppr" label="← Назад к ППР" />}
      />

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
    </section>
  );
}
