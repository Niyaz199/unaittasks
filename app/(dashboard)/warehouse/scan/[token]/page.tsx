import type { Route } from "next";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { BackButton } from "@/components/ui/back-button";
import { requireProfile } from "@/lib/auth";
import { canAccessWarehouseModule } from "@/lib/capabilities";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getWarehouseQrRedirectHref, resolveWarehouseQrTokenForProfile } from "@/lib/warehouse/qr";

export default async function WarehouseQrEntryPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const { profile } = await requireProfile();

  if (!canAccessWarehouseModule(profile.role)) {
    return (
      <section className="grid">
        <PageHeader title="QR склада" description="Безопасный QR-entry для мест хранения." actions={<BackButton fallback="/warehouse/items" />} />
        <div className="section-card">У вас нет доступа к модулю склада.</div>
      </section>
    );
  }

  const supabase = await createSupabaseServerClient();
  const resolution = await resolveWarehouseQrTokenForProfile(supabase, profile, token);
  if (resolution.kind === "location") {
    redirect(getWarehouseQrRedirectHref(resolution) as Route);
  }

  return (
    <section className="grid">
      <PageHeader title="QR склада" description="Безопасный QR-entry для мест хранения." actions={<BackButton fallback="/warehouse/items" />} />
      <div className="section-card">QR-код склада не найден или недоступен.</div>
    </section>
  );
}
