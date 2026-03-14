import { requireProfile } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  canAccessPprAssignmentScreens,
  listAssignableEquipmentForProfile,
  listAssignableTemplatesForProfile,
  listPprAssignmentsForProfile,
  listPprManageableObjectsForProfile,
} from "@/lib/ppr/queries";
import { PageHeader } from "@/components/ui/page-header";
import { BackButton } from "@/components/ui/back-button";
import { PprAssignmentsAdmin } from "@/components/ppr/assignments/ppr-assignments-admin";

export default async function PprAssignmentsPage() {
  const { profile } = await requireProfile();
  if (!canAccessPprAssignmentScreens(profile.role)) {
    return <div className="empty-state">Доступ к назначениям ППР запрещён.</div>;
  }

  const supabase = await createSupabaseServerClient();
  const [objects, assignments, equipmentOptions, templateOptions] = await Promise.all([
    listPprManageableObjectsForProfile(supabase, profile),
    listPprAssignmentsForProfile(supabase, profile),
    listAssignableEquipmentForProfile(supabase, profile),
    listAssignableTemplatesForProfile(supabase, profile),
  ]);

  return (
    <section className="grid">
      <PageHeader
        title="Назначения ППР"
        description="Связывание шаблонов ППР с конкретным оборудованием без перехода к календарю и генерации заявок."
        actions={<BackButton fallback="/ppr" label="← Назад к ППР" />}
      />

      <PprAssignmentsAdmin
        assignments={assignments}
        objects={objects}
        equipmentOptions={equipmentOptions}
        templateOptions={templateOptions}
      />
    </section>
  );
}
