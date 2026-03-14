import { requireProfile } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { canAccessPprSystemGroupScreens, listPprSystemGroupsForManagement } from "@/lib/ppr/queries";
import { PageHeader } from "@/components/ui/page-header";
import { BackButton } from "@/components/ui/back-button";
import { PprSystemGroupsAdmin } from "@/components/ppr/system-groups/ppr-system-groups-admin";

export default async function PprSystemGroupsPage() {
  const { profile } = await requireProfile();

  if (!canAccessPprSystemGroupScreens(profile.role)) {
    return (
      <section className="grid">
        <PageHeader title="Группы систем ППР" description="Доступ к справочнику ограничен." />
        <div className="section-card">У вас нет доступа к справочнику групп систем ППР.</div>
      </section>
    );
  }

  const supabase = await createSupabaseServerClient();
  const groups = await listPprSystemGroupsForManagement(supabase, profile);

  return (
    <section className="grid">
      <PageHeader
        title="Группы систем ППР"
        description="Глобальный справочник групп, который используется при создании и редактировании систем ППР."
        actions={<BackButton fallback="/ppr" label="← Назад к ППР" />}
      />
      <PprSystemGroupsAdmin groups={groups} />
    </section>
  );
}
