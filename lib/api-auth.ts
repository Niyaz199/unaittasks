import { getRequestSession } from "@/lib/auth";
import type { Profile } from "@/lib/types";

export async function getApiSession() {
  const { supabase, user, profile } = await getRequestSession();
  return { supabase, user, profile: (profile as Profile | null) ?? null };
}
