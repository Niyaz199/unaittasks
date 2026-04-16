import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";

export default async function HomePage() {
  const { profile } = await requireProfile();
  if (profile.role === "procurement_manager") {
    redirect("/purchase-requests");
  }
  redirect("/my");
}
