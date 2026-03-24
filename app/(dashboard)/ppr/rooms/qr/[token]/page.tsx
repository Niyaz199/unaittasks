import type { Route } from "next";
import { redirect } from "next/navigation";
import { BackButton } from "@/components/ui/back-button";
import { PageHeader } from "@/components/ui/page-header";
import { ObjectRoomQrState } from "@/components/ppr/rooms/object-room-qr-state";
import { requireProfile } from "@/lib/auth";
import { resolveObjectRoomQrTokenForProfile, getObjectRoomQrRedirectHref } from "@/lib/object-room-qr";
import { canReadObjectRooms } from "@/lib/object-rooms";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function ObjectRoomQrEntryPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const { profile } = await requireProfile();

  if (!canReadObjectRooms(profile.role)) {
    return (
      <section className="grid">
        <PageHeader
          title="QR помещения"
          description="Безопасная точка входа в карточку помещения по постоянному QR."
          actions={<BackButton fallback="/ppr" />}
        />
        <ObjectRoomQrState state="forbidden" />
      </section>
    );
  }

  const supabase = await createSupabaseServerClient();
  const resolution = await resolveObjectRoomQrTokenForProfile(supabase, profile, token);

  if (resolution.kind === "room") {
    redirect(getObjectRoomQrRedirectHref(resolution) as Route);
  }

  return (
    <section className="grid">
      <PageHeader
        title="QR помещения"
        description="Безопасная точка входа в карточку помещения по постоянному QR."
        actions={<BackButton fallback="/ppr" />}
      />
      <ObjectRoomQrState state={resolution.kind} />
    </section>
  );
}
