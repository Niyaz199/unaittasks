
import { notFound } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { canAccessPprStructureScreens, getPprEquipmentByIdForProfile } from "@/lib/ppr/queries";
import { PageHeader } from "@/components/ui/page-header";
import { BackButton } from "@/components/ui/back-button";
import { PprEquipmentDetails } from "@/components/ppr/equipment/ppr-equipment-details";

export default async function PprEquipmentDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { profile } = await requireProfile();
  if (!canAccessPprStructureScreens(profile.role)) {
    return <div className="empty-state">Доступ к оборудованию ППР запрещён.</div>;
  }

  const supabase = await createSupabaseServerClient();
  const details = await getPprEquipmentByIdForProfile(supabase, profile, id).catch(() => null);
  if (!details) notFound();

  return (
    <section className="grid">
      <PageHeader
        title="Карточка оборудования"
        description="Карточка оборудования ППР с деталями по структуре, активным QR и fallback-точкой для QR-entry."
        actions={<BackButton fallback="/ppr/equipment" />}
      />

      <PprEquipmentDetails equipment={details.equipment} qrCode={details.qrCode} />
    </section>
  );
}
