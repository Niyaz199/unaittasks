import type { SupabaseClient } from "@supabase/supabase-js";
import type { Profile } from "@/lib/types";
import { resolveRoundsQrTokenForProfile } from "@/lib/rounds/queries";

export async function resolveRoundsQrEntry(
  supabase: SupabaseClient,
  profile: Pick<Profile, "id" | "role">,
  token: string
) {
  return resolveRoundsQrTokenForProfile(supabase, profile, token);
}

export function getRoundsQrRedirectHref(token: string) {
  return `/rounds/scan?token=${encodeURIComponent(token)}`;
}
