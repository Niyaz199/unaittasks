import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { canAccessRoundsModule, canReadRoundsReports } from "@/lib/rounds/permissions";

export default async function RoundsPage() {
  const { profile } = await requireProfile();

  if (!canAccessRoundsModule(profile.role)) {
    redirect("/my");
  }

  redirect(canReadRoundsReports(profile.role) ? "/rounds/today" : "/rounds/scan");
}
