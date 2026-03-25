import { requireProfile } from "@/lib/auth";
import { BackButton } from "@/components/ui/back-button";
import { PageHeader } from "@/components/ui/page-header";
import { canReadRoundsReports } from "@/lib/rounds/permissions";
import { getRoundsTodayForProfile } from "@/lib/rounds/queries";
import { formatDateLabel } from "@/lib/rounds/date";
import { RoundsTodayBoard } from "@/components/rounds/rounds-today-board";

export default async function RoundsTodayPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const search = searchParams ? await searchParams : {};
  const { profile, supabase } = await requireProfile();

  if (!canReadRoundsReports(profile.role)) {
    return (
      <section className="grid">
        <PageHeader title="Обходы: сегодня" description="Доступ к странице ограничен." />
        <div className="section-card">У вас нет доступа к журналу обходов.</div>
      </section>
    );
  }

  const data = await getRoundsTodayForProfile(supabase, profile, {
    objectId: typeof search.objectId === "string" ? search.objectId : undefined,
    operationalDate: typeof search.operationalDate === "string" ? search.operationalDate : undefined,
    query: typeof search.q === "string" ? search.q : undefined,
  });

  return (
    <section className="grid">
      <PageHeader
        title="Обходы: сегодня"
        description={`Операционная дата: ${formatDateLabel(data.operationalDate)}. В списке только помещения, включенные в обходы.`}
        actions={<BackButton fallback="/rounds" label="← К обходам" />}
      />

      <RoundsTodayBoard
        objects={data.objects}
        rows={data.rows}
        initialObjectId={typeof search.objectId === "string" ? search.objectId : ""}
        initialOperationalDate={data.operationalDate}
        initialQuery={typeof search.q === "string" ? search.q : ""}
      />
    </section>
  );
}
