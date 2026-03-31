import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { BackButton } from "@/components/ui/back-button";
import { PageHeader } from "@/components/ui/page-header";
import { canManageRoundsConfig } from "@/lib/rounds/permissions";
import { listRoundsConfigRoomsForProfile, listRoundsManageableObjectsForProfile } from "@/lib/rounds/queries";
import { RoundsConfigAdmin } from "@/components/rounds/rounds-config-admin";

export default async function RoundsConfigPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const search = searchParams ? await searchParams : {};
  const { profile, supabase } = await requireProfile();

  if (profile.role === "tech") {
    redirect("/rounds/scan");
  }

  if (!canManageRoundsConfig(profile.role)) {
    return (
      <section className="grid">
        <PageHeader title="Конфигуратор обходов" description="Доступ к конфигуратору ограничен." />
        <div className="section-card">У вас нет прав на настройку обходов.</div>
      </section>
    );
  }

  const requestedObjectId = typeof search.objectId === "string" ? search.objectId : undefined;
  const data = requestedObjectId
    ? await listRoundsConfigRoomsForProfile(supabase, profile, {
        objectId: requestedObjectId,
        query: typeof search.q === "string" ? search.q : undefined,
      })
    : {
        objects: await listRoundsManageableObjectsForProfile(supabase, profile),
        rooms: [],
      };

  return (
    <section className="grid">
      <PageHeader
        title="Конфигуратор обходов"
        description="Массовое включение помещений в обходы и подготовка печати общих QR-кодов для участвующих помещений."
        actions={<BackButton fallback="/rounds/today" label="← К обходам" />}
      />
      <RoundsConfigAdmin
        objects={data.objects}
        rooms={data.rooms}
        initialObjectId={requestedObjectId ?? ""}
        initialQuery={typeof search.q === "string" ? search.q : ""}
      />
    </section>
  );
}
