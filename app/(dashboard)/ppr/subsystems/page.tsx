import { requireProfile } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  canAccessPprStructureScreens,
  listPprManageableObjectsForProfile,
  listPprSubsystemsForProfile,
  listPprSystemsForProfile,
} from "@/lib/ppr/queries";
import { PageHeader } from "@/components/ui/page-header";
import { BackButton } from "@/components/ui/back-button";
import { PprSubsystemsAdmin } from "@/components/ppr/subsystems/ppr-subsystems-admin";

export default async function PprSubsystemsPage() {
  const { profile } = await requireProfile();
  if (!canAccessPprStructureScreens(profile.role)) {
    return <div className="empty-state">Доступ к структуре ППР запрещён.</div>;
  }

  const supabase = await createSupabaseServerClient();
  const [objects, systems, subsystems] = await Promise.all([
    listPprManageableObjectsForProfile(supabase, profile),
    listPprSystemsForProfile(supabase, profile),
    listPprSubsystemsForProfile(supabase, profile),
  ]);

  return (
    <section className="grid">
      <PageHeader
        title="Подсистемы ППР"
        description="Дерево подсистем внутри систем ППР. На этом этапе доступны создание и редактирование."
        actions={<BackButton fallback="/ppr" label="← Назад к ППР" />}
      />

      <PprSubsystemsAdmin
        subsystems={subsystems}
        objects={objects}
        systems={systems.map((item) => ({ id: item.id, object_id: item.object_id, name: item.name }))}
      />
    </section>
  );
}
