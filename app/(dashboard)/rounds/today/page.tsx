import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { BackButton } from "@/components/ui/back-button";
import { PageHeader } from "@/components/ui/page-header";
import { canReadRoundsReports } from "@/lib/rounds/permissions";
import {
  getRoundsTodayForProfile,
  listRoundsReadableObjectsForProfile,
  listRoundsTodayObjectSummariesForProfile,
} from "@/lib/rounds/queries";
import { formatDateLabel } from "@/lib/rounds/date";
import { toOperationalDate } from "@/lib/rounds/date";
import { getRoundsProjectTimeZone } from "@/lib/rounds/constants";
import { RoundsTodayBoard } from "@/components/rounds/rounds-today-board";
import { RoundsTodayObjectHub } from "@/components/rounds/rounds-today-object-hub";

export default async function RoundsTodayPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const search = searchParams ? await searchParams : {};
  const { profile, supabase } = await requireProfile();

  if (profile.role === "tech") {
    redirect("/rounds/scan");
  }

  if (!canReadRoundsReports(profile.role)) {
    return (
      <section className="grid">
        <PageHeader title="Обходы: сегодня" description="Доступ к странице ограничен." />
        <div className="section-card">У вас нет доступа к журналу обходов.</div>
      </section>
    );
  }

  const requestedObjectId = typeof search.objectId === "string" ? search.objectId : "";
  const requestedDate = typeof search.operationalDate === "string" ? search.operationalDate : undefined;
  const requestedQuery = typeof search.q === "string" ? search.q : "";

  const objects = await listRoundsReadableObjectsForProfile(supabase, profile);
  const selectedObjectId = objects.some((item) => item.id === requestedObjectId) ? requestedObjectId : "";
  const shouldShowBoard = Boolean(selectedObjectId);
  const operationalDate = requestedDate?.trim() || toOperationalDate(new Date(), getRoundsProjectTimeZone());

  const [boardData, summaries] = await Promise.all([
    shouldShowBoard
      ? getRoundsTodayForProfile(supabase, profile, {
          objectId: selectedObjectId,
          operationalDate,
          query: requestedQuery || undefined,
        })
      : Promise.resolve(null),
    shouldShowBoard
      ? Promise.resolve([])
      : listRoundsTodayObjectSummariesForProfile(supabase, profile, { operationalDate }),
  ]);

  const description = shouldShowBoard
    ? `Операционная дата: ${formatDateLabel(boardData!.operationalDate)}. В списке только помещения, включенные в обходы.`
    : `Операционная дата: ${formatDateLabel(operationalDate)}. Выберите объект, чтобы увидеть список помещений.`;

  return (
    <section className="grid">
      <PageHeader
        title="Обходы: сегодня"
        description={description}
        actions={<BackButton fallback="/rounds" label="← К обходам" />}
      />

      {shouldShowBoard ? (
        <RoundsTodayBoard
          objects={boardData!.objects}
          rows={boardData!.rows}
          initialObjectId={selectedObjectId}
          initialOperationalDate={boardData!.operationalDate}
          initialQuery={requestedQuery}
        />
      ) : (
        <RoundsTodayObjectHub summaries={summaries} operationalDate={operationalDate} />
      )}
    </section>
  );
}
