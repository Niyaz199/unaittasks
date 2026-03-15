import { requireProfile } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
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

export default async function PprEquipmentPage() {
  const { profile } = await requireProfile();
  if (!canAccessPprStructureScreens(profile.role)) {
    return <div className="empty-state">Доступ к оборудованию ППР запрещён.</div>;
  }

  const supabase = await createSupabaseServerClient();
  const [objects, systems, rooms, equipment] = await Promise.all([
    listPprManageableObjectsForProfile(supabase, profile),
    listPprSystemsForProfile(supabase, profile),
    listObjectRoomsForProfile(supabase, profile),
    listPprEquipmentForProfile(supabase, profile),
  ]);

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
        rooms={rooms.map((item) => ({ id: item.id, object_id: item.object_id, name: item.name }))}
      />
    </section>
  );
}
