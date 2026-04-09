import { requireProfile } from "@/lib/auth";
import { canAccessPurchaseRequestsModule, canManagePurchaseRequests } from "@/lib/capabilities";
import { listPurchaseRequestsForProfile, listPurchaseRequestReadableObjectsForProfile } from "@/lib/purchase-requests/queries";
import { listStockItemOptionsForProfile } from "@/lib/warehouse/queries";
import { PageHeader } from "@/components/ui/page-header";
import { BackButton } from "@/components/ui/back-button";
import { PurchaseRequestsAdmin } from "@/components/purchase-requests/purchase-requests-admin";

export default async function PurchaseRequestsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const search = searchParams ? await searchParams : {};
  const { profile, supabase } = await requireProfile();

  if (!canAccessPurchaseRequestsModule(profile.role)) {
    return <div className="empty-state">Доступ к закупкам запрещён.</div>;
  }

  const objects = await listPurchaseRequestReadableObjectsForProfile(supabase, profile);
  const requestedObjectId = typeof search.objectId === "string" ? search.objectId : "";
  const selectedObjectId = objects.some((item) => item.id === requestedObjectId) ? requestedObjectId : "";
  const [requests, stockItems] = await Promise.all([
    listPurchaseRequestsForProfile(supabase, profile, selectedObjectId ? { objectId: selectedObjectId } : {}),
    listStockItemOptionsForProfile(supabase, profile, selectedObjectId ? { objectId: selectedObjectId, includeInactive: true } : { includeInactive: true }),
  ]);

  return (
    <section className="grid">
      <PageHeader
        title="Заявки на закупку"
        description="Общий реестр ручных и автоматических заявок на закупку по объектам."
        actions={<BackButton fallback="/warehouse/items" />}
      />
      <PurchaseRequestsAdmin
        requests={requests}
        objects={objects.map((item) => ({ id: item.id, name: item.name }))}
        stockItems={stockItems.map((item) => ({ id: item.id, object_id: item.object_id, name: item.name, unit: item.unit, is_active: item.is_active }))}
        canManage={canManagePurchaseRequests(profile.role)}
        initialFilterObjectId={selectedObjectId}
      />
    </section>
  );
}
