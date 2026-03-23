import { PageHeader } from "@/components/ui/page-header";
import { RoomTypesAdminList } from "@/components/dictionaries/room-types-admin-list";
import { canManageRoomTypesDirectory, canReadRoomTypesDirectory, requireProfile } from "@/lib/auth";
import { listRoomTypesForProfile } from "@/lib/room-types";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function RoomTypesDirectoryPage() {
  const { profile } = await requireProfile();
  if (!canReadRoomTypesDirectory(profile.role)) {
    return (
      <section className="grid">
        <PageHeader title="Типы помещений" description="Доступ к справочнику ограничен." />
        <div className="section-card">У вас нет доступа к справочнику типов помещений.</div>
      </section>
    );
  }

  const supabase = await createSupabaseServerClient();
  const roomTypes = await listRoomTypesForProfile(supabase, profile);

  return (
    <section className="grid">
      <PageHeader
        title="Типы помещений"
        description="Глобальный справочник типов помещений для ППР и будущего модуля обходов."
      />
      <RoomTypesAdminList roomTypes={roomTypes} canManage={canManageRoomTypesDirectory(profile.role)} />
    </section>
  );
}
