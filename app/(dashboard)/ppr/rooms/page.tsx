import { requireProfile } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { canAccessPprStructureScreens, listPprManageableObjectsForProfile, listPprRoomsForProfile } from "@/lib/ppr/queries";
import { PageHeader } from "@/components/ui/page-header";
import { BackButton } from "@/components/ui/back-button";
import { PprRoomsAdmin } from "@/components/ppr/rooms/ppr-rooms-admin";

export default async function PprRoomsPage() {
  const { profile } = await requireProfile();
  if (!canAccessPprStructureScreens(profile.role)) {
    return <div className="empty-state">Доступ к структуре ППР запрещён.</div>;
  }

  const supabase = await createSupabaseServerClient();
  const [objects, rooms] = await Promise.all([
    listPprManageableObjectsForProfile(supabase, profile),
    listPprRoomsForProfile(supabase, profile),
  ]);

  return (
    <section className="grid">
      <PageHeader
        title="Помещения ППР"
        description="Справочник помещений в рамках доступных объектов. Используется дальше для привязки оборудования."
        actions={<BackButton fallback="/ppr" label="← Назад к ППР" />}
      />

      <PprRoomsAdmin rooms={rooms} objects={objects} />
    </section>
  );
}
