import { notFound } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { canAccessWarehouseModule, canManageWarehouseCatalog } from "@/lib/capabilities";
import { recordStockMovementAction } from "@/app/actions/warehouse-actions";
import { PageHeader } from "@/components/ui/page-header";
import { BackButton } from "@/components/ui/back-button";
import { StockLocationDetails } from "@/components/warehouse/stock-location-details";
import { stockItemKindMeta } from "@/lib/warehouse/presentation";
import { getStockLocationByIdForProfile, listStockItemOptionsForProfile } from "@/lib/warehouse/queries";

export default async function StockLocationDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { profile, supabase } = await requireProfile();

  if (!canAccessWarehouseModule(profile.role)) {
    return <div className="empty-state">Доступ к складу запрещён.</div>;
  }

  const details = await getStockLocationByIdForProfile(supabase, profile, id).catch(() => null);
  if (!details) notFound();

  const stockItems = await listStockItemOptionsForProfile(supabase, profile, {
    objectId: details.location.object_id,
    includeInactive: true,
  });
  const locationQtyByItemId = new Map(details.balances.map((balance) => [balance.item_id, balance.qty]));
  const movementItems = stockItems.map((item) => ({
    id: item.id,
    name: item.name,
    unit: item.unit,
    kindLabel: stockItemKindMeta[item.kind].label,
    locationQty: locationQtyByItemId.get(item.id) ?? 0,
    totalQty: item.current_qty,
    minQty: item.min_qty,
    isActive: item.is_active,
  }));

  return (
    <section className="grid">
      <PageHeader
        title={details.location.name}
        description={`Объект: ${Array.isArray(details.location.object) ? (details.location.object[0]?.name ?? "—") : (details.location.object?.name ?? "—")}. Остатки, движения и QR-доступ в одной карточке.`}
        actions={<BackButton fallback="/warehouse/locations" />}
      />
      <StockLocationDetails
        location={details.location}
        qrCode={details.qrCode}
        balances={details.balances}
        movements={details.movements}
        movementItems={movementItems}
        canRegenerateQr={canManageWarehouseCatalog(profile.role)}
        canRecordMovement={canAccessWarehouseModule(profile.role)}
        recordMovementAction={recordStockMovementAction}
      />
    </section>
  );
}
