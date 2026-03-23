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

const getProfileByUserId = cache(async (userId: string) => {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("profiles")
    .select("id,full_name,role")
    .eq("id", userId)
    .single();
  return data as Profile | null;
});

export async function getSessionUser() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  return user;
}

export async function requireAuth() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return user;
}

export async function getMyProfile(): Promise<Profile | null> {
  const user = await getSessionUser();
  if (!user) return null;

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("profiles")
    .select("id,full_name,role")
    .eq("id", user.id)
    .single();
  return data as Profile | null;
}

export async function requireProfile() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const profile = await getProfileByUserId(user.id);
  if (!profile) {
    await supabase.auth.signOut();
    redirect("/login?error=profile_missing");
  }
  return { user, profile };
}
