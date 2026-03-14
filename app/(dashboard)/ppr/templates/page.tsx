import { requireProfile } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  canAccessPprTemplateScreens,
  listPprManageableObjectsForProfile,
  listPprSubsystemsForProfile,
  listPprWorkTemplatesForProfile,
} from "@/lib/ppr/queries";
import { PageHeader } from "@/components/ui/page-header";
import { BackButton } from "@/components/ui/back-button";
import { PprTemplatesAdmin } from "@/components/ppr/templates/ppr-templates-admin";

export default async function PprTemplatesPage() {
  const { profile } = await requireProfile();
  if (!canAccessPprTemplateScreens(profile.role)) {
    return <div className="empty-state">Доступ к шаблонам ППР запрещён.</div>;
  }

  const supabase = await createSupabaseServerClient();
  const [objects, subsystems, templates] = await Promise.all([
    listPprManageableObjectsForProfile(supabase, profile),
    listPprSubsystemsForProfile(supabase, profile),
    listPprWorkTemplatesForProfile(supabase, profile),
  ]);

  return (
    <section className="grid">
      <PageHeader
        title="Шаблоны ППР"
        description="Шаблоны периодических работ на уровне подсистем с базовой датой, периодичностью и чек-листом."
        actions={<BackButton fallback="/ppr" label="← Назад к ППР" />}
      />

      <PprTemplatesAdmin
        templates={templates}
        objects={objects}
        subsystems={subsystems.map((item) => ({ id: item.id, object_id: item.object_id, system_id: item.system_id, name: item.name }))}
      />
    </section>
  );
}
