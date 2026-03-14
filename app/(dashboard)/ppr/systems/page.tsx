import { requireProfile } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  canAccessPprStructureScreens,
  canAccessPprSystemGroupScreens,
  listPprManageableObjectsForProfile,
  listPprResponsibleCandidates,
  listPprSystemGroups,
  listPprSystemsForProfile,
} from "@/lib/ppr/queries";
import { PageHeader } from "@/components/ui/page-header";
import { BackButton } from "@/components/ui/back-button";
import { PprSystemsAdmin } from "@/components/ppr/systems/ppr-systems-admin";

export default async function PprSystemsPage() {
  const { profile } = await requireProfile();
  if (!canAccessPprStructureScreens(profile.role)) {
    return <div className="empty-state">Доступ к структуре ППР запрещён.</div>;
  }

  const supabase = await createSupabaseServerClient();
  const [objects, systemGroups, systems] = await Promise.all([
    listPprManageableObjectsForProfile(supabase, profile),
    listPprSystemGroups(supabase, profile),
    listPprSystemsForProfile(supabase, profile),
  ]);
  const responsibleCandidates = await listPprResponsibleCandidates(
    supabase,
    profile.role === "admin" || profile.role === "chief" ? objects.map((item) => item.id) : objects.map((item) => item.id)
  );

  return (
    <section className="grid">
      <PageHeader
        title="Системы ППР"
        description="Создание и редактирование систем ППР с выбором объекта, группы и ответственного."
        actions={<BackButton fallback="/ppr" label="← Назад к ППР" />}
      />

      <PprSystemsAdmin
        systems={systems}
        objects={objects}
        systemGroups={systemGroups}
        responsibleCandidates={responsibleCandidates}
        canManageSystemGroups={canAccessPprSystemGroupScreens(profile.role)}
      />
    </section>
  );
}
