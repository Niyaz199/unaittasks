import { PageHeader } from "@/components/ui/page-header";
import { FloorsAdminList } from "@/components/dictionaries/floors-admin-list";
import { canManageFloorsDirectory, canReadFloorsDirectory, requireProfile } from "@/lib/auth";
import { listFloorsForProfile } from "@/lib/floors";
import { listObjectRoomReadableObjectsForProfile } from "@/lib/object-rooms";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function FloorsDirectoryPage() {
  const { profile } = await requireProfile();
  if (!canReadFloorsDirectory(profile.role)) {
    return (
      <section className="grid">
        <PageHeader title="Этажи" description="Доступ к справочнику ограничен." />
        <div className="section-card">У вас нет доступа к справочнику этажей.</div>
      </section>
    );
  }

  const supabase = await createSupabaseServerClient();
  const [floors, objects] = await Promise.all([
    listFloorsForProfile(supabase, profile),
    listObjectRoomReadableObjectsForProfile(supabase, profile),
  ]);

  return (
    <section className="grid">
      <PageHeader
        title="Этажи"
        description="Глобальный справочник этажей, привязанных к объектам. Используется помещениями ППР и подготовлен для будущего модуля обходов."
      />
      <FloorsAdminList floors={floors} objects={objects} canManage={canManageFloorsDirectory(profile.role)} />
    </section>
  );
}
