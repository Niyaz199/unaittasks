import { notFound } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { canManageObjectRooms, canReadObjectRooms, getObjectRoomByIdForProfile } from "@/lib/object-rooms";
import { BackButton } from "@/components/ui/back-button";
import { PageHeader } from "@/components/ui/page-header";
import { ObjectRoomDetails } from "@/components/ppr/rooms/object-room-details";

export default async function ObjectRoomDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { profile } = await requireProfile();

  if (!canReadObjectRooms(profile.role)) {
    return <div className="empty-state">Доступ к карточке помещения запрещён.</div>;
  }

  const supabase = await createSupabaseServerClient();
  const details = await getObjectRoomByIdForProfile(supabase, profile, id).catch(() => null);
  if (!details) notFound();

  return (
    <section className="grid">
      <PageHeader
        title="Карточка помещения"
        description="Общая карточка помещения с постоянным QR и отдельным флагом участия в обходах."
        actions={<BackButton fallback="/ppr" />}
      />
      <ObjectRoomDetails room={details.room} qrCode={details.qrCode} canRegenerateQr={canManageObjectRooms(profile.role)} />
    </section>
  );
}
