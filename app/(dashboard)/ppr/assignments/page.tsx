import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { canAccessPprTemplateScreens } from "@/lib/ppr/queries";

export default async function PprAssignmentsPage() {
  const { profile } = await requireProfile();

  if (!canAccessPprTemplateScreens(profile.role)) {
    return <div className="empty-state">Доступ к шаблонам ППР запрещён.</div>;
  }

  redirect("/ppr/templates");
}
