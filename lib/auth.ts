import { unstable_cache } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Profile, Role } from "@/lib/types";

const getProfileByUserIdCached = (userId: string) =>
  unstable_cache(
    async () => {
      const supabase = await createSupabaseServerClient();
      const { data } = await supabase
        .from("profiles")
        .select("id,full_name,role")
        .eq("id", userId)
        .single();
      return data as Profile | null;
    },
    ["profile-by-user-id", userId],
    { revalidate: 300 }
  )();

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

  const profile = await getProfileByUserIdCached(user.id);
  if (!profile) {
    await supabase.auth.signOut();
    redirect("/login?error=profile_missing");
  }
  return { user, profile };
}

export function canViewAudit(role: Role) {
  return role === "admin" || role === "chief";
}

export function canManageObjects(role: Role) {
  return role === "admin" || role === "chief";
}

export function canManageUsers(role: Role) {
  return role === "admin" || role === "chief";
}

export function canEditTasks(role: Role) {
  return role === "admin" || role === "chief" || role === "lead" || role === "engineer" || role === "object_engineer";
}

export function canManageTaskTeam(role: Role) {
  return role === "admin" || role === "chief" || role === "lead" || role === "engineer" || role === "object_engineer";
}

export function isSuperuser(role: Role) {
  return role === "admin";
}
