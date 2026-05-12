import { requireProfile } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  canAccessPprStructureScreens,
  canAccessPprSystemGroupScreens,
  listPprManageableObjectsForProfile,
  listPprResponsibleCandidates,
  listPprSystemGroups,
  listPprSystemsForProfile,
  listPprSystemsObjectSummariesForProfile,
} from "@/lib/ppr/queries";
import { PageHeader } from "@/components/ui/page-header";
import { BackButton } from "@/components/ui/back-button";
import { PprSystemsAdmin } from "@/components/ppr/systems/ppr-systems-admin";
import { PprSystemsObjectHub } from "@/components/ppr/systems/ppr-systems-object-hub";

export default async function PprSystemsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const search = searchParams ? await searchParams : {};
  const { profile } = await requireProfile();
  if (!canAccessPprStructureScreens(profile.role)) {
    return <div className="empty-state">Доступ к структуре ППР запрещён.</div>;
  }
  const initialCreateOpen = search.new === "1";

  const supabase = await createSupabaseServerClient();
  const objects = await listPprManageableObjectsForProfile(supabase, profile);
  const requestedObjectId = typeof search.objectId === "string" ? search.objectId : "";
  const selectedObjectId = objects.some((item) => item.id === requestedObjectId) ? requestedObjectId : "";
  const shouldShowCatalog = Boolean(selectedObjectId);

  const [systemGroups, systems, summaries] = await Promise.all([
    shouldShowCatalog ? listPprSystemGroups(supabase, profile) : Promise.resolve([]),
    shouldShowCatalog ? listPprSystemsForProfile(supabase, profile, { objectId: selectedObjectId }) : Promise.resolve([]),
    shouldShowCatalog ? Promise.resolve([]) : listPprSystemsObjectSummariesForProfile(supabase, profile),
  ]);

  const responsibleCandidates = shouldShowCatalog
    ? await listPprResponsibleCandidates(
        supabase,
        profile.role === "admin" || profile.role === "chief" ? objects.map((item) => item.id) : objects.map((item) => item.id)
      )
    : [];

  const objectName = objects.find((o) => o.id === selectedObjectId)?.name ?? "";
  const description = shouldShowCatalog
    ? `«${objectName}»: системы ППР, группы и ответственные.`
    : "Выберите объект, чтобы работать с его системами ППР.";

  return (
    <section className="grid">
      <PageHeader
        title="Системы ППР"
        description={description}
        actions={<BackButton fallback="/ppr" label="← Назад к ППР" />}
      />

      {shouldShowCatalog ? (
        <PprSystemsAdmin
          systems={systems}
          objects={objects}
          systemGroups={systemGroups}
          responsibleCandidates={responsibleCandidates}
          canManageSystemGroups={canAccessPprSystemGroupScreens(profile.role)}
          initialCreateOpen={initialCreateOpen}
        />
      ) : (
        <PprSystemsObjectHub summaries={summaries} />
      )}
    </section>
  );
}
