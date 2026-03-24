import type { SupabaseClient } from "@supabase/supabase-js";
import type { Profile } from "@/lib/types";
import { getObjectRoomByIdForProfile, getObjectRoomQrCodeByTokenForProfile } from "@/lib/object-rooms";

export type ObjectRoomQrResolution =
  | { kind: "room"; roomId: string }
  | { kind: "invalid" }
  | { kind: "forbidden" };

export async function resolveObjectRoomQrTokenForProfile(
  supabase: SupabaseClient,
  profile: Pick<Profile, "id" | "role">,
  token: string
): Promise<ObjectRoomQrResolution> {
  const normalizedToken = token.trim();
  if (!normalizedToken) return { kind: "invalid" };

  const qrCode = await getObjectRoomQrCodeByTokenForProfile(supabase, profile, normalizedToken);
  if (!qrCode) return { kind: "invalid" };

  const room = await getObjectRoomByIdForProfile(supabase, profile, qrCode.room_id).catch(() => null);
  if (!room) return { kind: "invalid" };

  return { kind: "room", roomId: qrCode.room_id };
}

export function getObjectRoomQrRedirectHref(resolution: Extract<ObjectRoomQrResolution, { kind: "room" }>) {
  return `/ppr/rooms/${resolution.roomId}`;
}
