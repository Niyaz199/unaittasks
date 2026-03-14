import type { Route } from "next";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { BackButton } from "@/components/ui/back-button";
import { PprQrState } from "@/components/ppr/qr/ppr-qr-state";
import { requireProfile } from "@/lib/auth";
import { canAccessPprModule } from "@/lib/ppr/permissions";
import { getPprQrRedirectHref, resolvePprQrTokenForProfile } from "@/lib/ppr/qr";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function PprQrEntryPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const { profile } = await requireProfile();

  if (!canAccessPprModule(profile.role)) {
    return (
      <section className="grid">
        <PageHeader
          title="QR ППР"
          description="Безопасный QR-entry для оборудования и активных ППР-заявок."
          actions={<BackButton fallback="/ppr" />}
        />
        <PprQrState state="forbidden" />
      </section>
    );
  }

  const supabase = await createSupabaseServerClient();
  const resolution = await resolvePprQrTokenForProfile(supabase, profile, token);

  if (resolution.kind === "task" || resolution.kind === "equipment") {
    redirect(getPprQrRedirectHref(resolution) as Route);
  }

  return (
    <section className="grid">
      <PageHeader
        title="QR ППР"
        description="Безопасный QR-entry для оборудования и активных ППР-заявок."
        actions={<BackButton fallback="/ppr" />}
      />
      <PprQrState state={resolution.kind} />
    </section>
  );
}
