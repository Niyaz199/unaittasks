import { NextResponse } from "next/server";
import { getApiSession } from "@/lib/api-auth";
import { getObjectRoomQrRedirectHref, resolveObjectRoomQrTokenForProfile } from "@/lib/object-room-qr";
import { canReadObjectRooms } from "@/lib/object-rooms";

export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const { supabase, profile } = await getApiSession();

  if (!profile || !canReadObjectRooms(profile.role)) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const resolution = await resolveObjectRoomQrTokenForProfile(supabase, profile, token);
  if (resolution.kind === "room") {
    return NextResponse.redirect(new URL(getObjectRoomQrRedirectHref(resolution), request.url));
  }

  return NextResponse.redirect(new URL(`/ppr/rooms/qr/${encodeURIComponent(token)}`, request.url));
}
