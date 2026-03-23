import { requireProfile } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { BackButton } from "@/components/ui/back-button";
import { PageHeader } from "@/components/ui/page-header";
import { canManageRoundsConfig } from "@/lib/rounds/permissions";
import { listRoundsConfigRoomsForProfile } from "@/lib/rounds/queries";
import { RoundsConfigAdmin } from "@/components/rounds/rounds-config-admin";

export default async function RoundsConfigPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const search = searchParams ? await searchParams : {};
  const { profile } = await requireProfile();

  if (!canManageRoundsConfig(profile.role)) {
    return (
      <section className="grid">
        <PageHeader title="Конфигуратор обходов" description="Доступ к конфигуратору ограничен." />
        <div className="section-card">У вас нет прав на настройку обходов.</div>
      </section>
    );
  }

  const supabase = await createSupabaseServerClient();
  const data = await listRoundsConfigRoomsForProfile(supabase, profile, {
    objectId: typeof search.objectId === "string" ? search.objectId : undefined,
    query: typeof search.q === "string" ? search.q : undefined,
  });

  return (
    <section className="grid">
      <PageHeader
        title="Конфигуратор обходов"
        description="Массовое включение помещений в обходы, генерация отсутствующих QR и подготовка печати."
        actions={<BackButton fallback="/rounds/today" label="← К обходам" />}
      />
      <RoundsConfigAdmin
        objects={data.objects}
        rooms={data.rooms}
        initialObjectId={typeof search.objectId === "string" ? search.objectId : ""}
        initialQuery={typeof search.q === "string" ? search.q : ""}
      />
    </section>
  );
}
