
import { notFound } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { updatePprWorkTemplateAction } from "@/app/actions/ppr-template-actions";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  canAccessPprTemplateScreens,
  getPprWorkTemplateByIdForProfile,
  listPprManageableObjectsForProfile,
  listPprSystemsForProfile,
} from "@/lib/ppr/queries";
import { PageHeader } from "@/components/ui/page-header";
import { BackButton } from "@/components/ui/back-button";
import { PprTemplateDetails } from "@/components/ppr/templates/ppr-template-details";

export default async function PprTemplateDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { profile } = await requireProfile();
  if (!canAccessPprTemplateScreens(profile.role)) {
    return <div className="empty-state">Доступ к шаблонам ППР запрещён.</div>;
  }

  const supabase = await createSupabaseServerClient();
  const [objects, systems, details] = await Promise.all([
    listPprManageableObjectsForProfile(supabase, profile),
    listPprSystemsForProfile(supabase, profile),
    getPprWorkTemplateByIdForProfile(supabase, profile, id).catch(() => null),
  ]);
  if (!details) notFound();

  return (
    <section className="grid">
      <PageHeader
        title="Карточка шаблона ППР"
        description="Редактирование системного шаблона ППР. Активный шаблон участвует в планировании для всего активного оборудования выбранной системы."
        actions={<BackButton fallback="/ppr/templates" />}
      />

      <PprTemplateDetails
        template={details.template}
        checklistItems={details.checklistItems}
        objects={objects}
        systems={systems.map((item) => ({ id: item.id, object_id: item.object_id, name: item.name }))}
        onSave={updatePprWorkTemplateAction}
      />
    </section>
  );
}
