import { requireProfile } from "@/lib/auth";
import { canManageDailyChecklistTemplates } from "@/lib/daily-checklists/access";
import {
  listDailyChecklistTemplateProfilesForProfile,
  listDailyChecklistTemplatesForProfile,
} from "@/lib/daily-checklists/queries";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ChecklistTemplatesAdmin } from "@/components/checklists/checklist-templates-admin";
import { PageHeader } from "@/components/ui/page-header";
import { BackButton } from "@/components/ui/back-button";

export default async function DailyChecklistTemplatesPage() {
  const { profile } = await requireProfile();
  if (!canManageDailyChecklistTemplates(profile.role)) {
    return (
      <section className="grid">
        <PageHeader title="Шаблоны чек-листов" description="Доступ к управлению шаблонами ограничен." />
        <div className="section-card">У вас нет доступа к управлению шаблонами чек-листов.</div>
      </section>
    );
  }

  const supabase = await createSupabaseServerClient();
  const [templates, profiles] = await Promise.all([
    listDailyChecklistTemplatesForProfile(supabase, profile),
    listDailyChecklistTemplateProfilesForProfile(supabase, profile),
  ]);

  return (
    <section className="grid" style={{ gap: "1rem" }}>
        <PageHeader
          title="Шаблоны чек-листов"
          description="У каждого инженера свой персональный шаблон. Сохранение создаёт новую активную версию."
          actions={<BackButton fallback="/checklists" label="← К чек-листам" />}
        />
      <ChecklistTemplatesAdmin templates={templates} profiles={profiles} />
    </section>
  );
}
