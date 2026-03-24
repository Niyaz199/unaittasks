import { requireProfile } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { BackButton } from "@/components/ui/back-button";
import { PageHeader } from "@/components/ui/page-header";
import { canManageRoundsConfig } from "@/lib/rounds/permissions";
import { getRoundsPrintRowsForProfile } from "@/lib/rounds/queries";
import { RoundsQrBoard } from "@/components/rounds/rounds-qr-board";

export default async function RoundsQrPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const search = searchParams ? await searchParams : {};
  const { profile } = await requireProfile();

  if (!canManageRoundsConfig(profile.role)) {
    return (
      <section className="grid">
        <PageHeader title="QR помещений" description="Доступ к QR-выгрузке ограничен." />
        <div className="section-card">У вас нет прав на просмотр и печать QR помещений.</div>
      </section>
    );
  }

  const supabase = await createSupabaseServerClient();
  const roomIdValue = typeof search.roomId === "string" ? [search.roomId] : Array.isArray(search.roomId) ? search.roomId : undefined;
  const rooms = await getRoundsPrintRowsForProfile(supabase, profile, {
    objectId: typeof search.objectId === "string" ? search.objectId : undefined,
    roomIds: roomIdValue,
  });

  return (
    <section className="grid">
      <PageHeader
        title="QR помещений"
        description="Печатная форма и поштучная выгрузка общих QR-кодов помещений, участвующих в обходах."
        actions={<BackButton fallback="/rounds/config" label="← К конфигуратору" />}
      />
      <RoundsQrBoard rooms={rooms} />
    </section>
  );
}
