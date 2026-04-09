
import { notFound } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { canManageWarehouseCatalog } from "@/lib/capabilities";
import { canAccessPprStructureScreens, getPprEquipmentByIdForProfile } from "@/lib/ppr/queries";
import { listEquipmentComponentsForProfile, listStockItemOptionsForProfile } from "@/lib/warehouse/queries";
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
  const [components, stockItems] = await Promise.all([
    listEquipmentComponentsForProfile(supabase, profile, id),
    listStockItemOptionsForProfile(supabase, profile, {
      objectId: details.equipment.object_id,
      includeInactive: true,
    }),
  ]);

  return (
    <section className="grid">
      <PageHeader
        title="Карточка оборудования"
        description="Карточка оборудования ППР с деталями по структуре, активным QR и fallback-точкой для QR-entry."
        actions={<BackButton fallback="/ppr/equipment" />}
      />

      <PprEquipmentDetails
        equipment={details.equipment}
        qrCode={details.qrCode}
        components={components}
        stockItems={stockItems.map((item) => ({
          id: item.id,
          name: item.name,
          kind: item.kind,
          unit: item.unit,
          min_qty: item.min_qty,
          current_qty: item.current_qty,
        }))}
        canManageComponents={canManageWarehouseCatalog(profile.role)}
      />
    </section>
  );
}
