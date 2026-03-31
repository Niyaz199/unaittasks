import dynamic from "next/dynamic";
import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { BackButton } from "@/components/ui/back-button";
import { PageHeader } from "@/components/ui/page-header";
import { canManageRoundsConfig } from "@/lib/rounds/permissions";
import { getRoundsPrintRowsForProfile, listRoundsConfigRoomsForProfile } from "@/lib/rounds/queries";

const RoundsQrBoard = dynamic(
  () => import("@/components/rounds/rounds-qr-board").then((module) => module.RoundsQrBoard),
  {
    loading: () => <div className="section-card text-soft">Подготавливаем QR-доску...</div>,
  }
);

export default async function RoundsQrPage({
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
        <PageHeader title="QR помещений" description="Доступ к QR-выгрузке ограничен." />
        <div className="section-card">У вас нет прав на просмотр и печать QR помещений.</div>
      </section>
    );
  }

  const selectedObjectId =
    typeof search.object === "string" ? search.object : typeof search.objectId === "string" ? search.objectId : undefined;
  const selectedFloorName = typeof search.floor === "string" ? search.floor : undefined;
  const roomIdValue = typeof search.roomId === "string" ? [search.roomId] : Array.isArray(search.roomId) ? search.roomId : undefined;
  const [filterData, rooms] = await Promise.all([
    listRoundsConfigRoomsForProfile(supabase, profile, { objectId: selectedObjectId }),
    getRoundsPrintRowsForProfile(supabase, profile, {
      objectId: selectedObjectId,
      floorName: selectedFloorName,
      roomIds: roomIdValue,
    }),
  ]);
  const floorOptions = Array.from(
    new Set(filterData.rooms.filter((room) => room.rounds_enabled && room.room_qr_token).map((room) => room.floor_name))
  ).sort((left, right) => left.localeCompare(right, "ru", { numeric: true }));

  return (
    <section className="grid">
      <PageHeader
        title="QR помещений"
        description="Печатная форма и поштучная выгрузка общих QR-кодов помещений, участвующих в обходах."
        actions={<BackButton fallback="/rounds/config" label="← К конфигуратору" />}
      />
      <RoundsQrBoard
        rooms={rooms}
        objects={filterData.objects}
        floorOptions={floorOptions}
        selectedObjectId={selectedObjectId ?? ""}
        selectedFloorName={selectedFloorName ?? ""}
      />
    </section>
  );
}
