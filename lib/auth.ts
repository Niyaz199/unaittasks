import { cache } from "react";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";
export {
  canAccessDirectories,
  canEditTasks,
  canManageFloorsDirectory,
  canManageObjects,
  canManageRoomTypesDirectory,
  canManageTaskTeam,
  canManageUsers,
  canReadFloorsDirectory,
  canReadRoomTypesDirectory,
  canViewAudit,
  isSuperuser,
} from "@/lib/capabilities";

const getProfileByUserId = cache(
  async (supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>, userId: string) => {
    const { data } = await supabase
      .from("profiles")
      .select("id,full_name,role")
      .eq("id", userId)
      .single();
    return data as Profile | null;
  }
);

export const getRequestSession = cache(async () => {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return { supabase, user: null, profile: null };
  }

  const profile = await getProfileByUserId(supabase, user.id);
  return { supabase, user, profile };
});

export async function getSessionUser() {
  const { user } = await getRequestSession();
  return user;
}

export async function requireAuth() {
  const { user } = await getRequestSession();
  if (!user) redirect("/login");
  return user;
}

export async function getMyProfile(): Promise<Profile | null> {
  const { profile } = await getRequestSession();
  return profile;
}

export async function requireProfile() {
  const { supabase, user, profile } = await getRequestSession();
  if (!user) redirect("/login");

  if (!profile) {
    await supabase.auth.signOut();
    redirect("/login?error=profile_missing");
  }

  return { supabase, user, profile };
}
