import { requireProfile } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  canAccessPprStructureScreens,
  listPprEquipmentForProfile,
  listPprManageableObjectsForProfile,
  listPprRoomsForProfile,
  listPprSubsystemsForProfile,
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
  const [objects, systems, subsystems, rooms, equipment] = await Promise.all([
    listPprManageableObjectsForProfile(supabase, profile),
    listPprSystemsForProfile(supabase, profile),
    listPprSubsystemsForProfile(supabase, profile),
    listPprRoomsForProfile(supabase, profile),
    listPprEquipmentForProfile(supabase, profile),
  ]);

  return (
    <section className="grid">
      <PageHeader
        title="Оборудование ППР"
        description="Справочник оборудования с привязкой к объекту, системе, подсистеме и помещению."
        actions={<BackButton fallback="/ppr" label="← Назад к ППР" />}
      />

      <PprEquipmentAdmin
        equipment={equipment}
        objects={objects}
        systems={systems.map((item) => ({ id: item.id, object_id: item.object_id, name: item.name }))}
        subsystems={subsystems.map((item) => ({ id: item.id, object_id: item.object_id, system_id: item.system_id, name: item.name }))}
        rooms={rooms.map((item) => ({ id: item.id, object_id: item.object_id, name: item.name }))}
      />
    </section>
  );
}
