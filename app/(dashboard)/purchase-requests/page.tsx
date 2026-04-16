import { requireProfile } from "@/lib/auth";
import { canAccessPurchaseRequestsModule, canCreatePurchaseRequests, canManagePurchaseRequests } from "@/lib/capabilities";
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

  const requestedObjectId = typeof search.objectId === "string" ? search.objectId : "";
  const canCreate = canCreatePurchaseRequests(profile.role);
  const canManage = canManagePurchaseRequests(profile.role);
  const readableObjects = await listPurchaseRequestReadableObjectsForProfile(supabase, profile);
  const selectedObjectId = readableObjects.some((item) => item.id === requestedObjectId) ? requestedObjectId : "";
  const requests = await listPurchaseRequestsForProfile(supabase, profile, selectedObjectId ? { objectId: selectedObjectId } : {});
  const objects = readableObjects;
  const stockItems = canCreate
    ? await listStockItemOptionsForProfile(
        supabase,
        profile,
        selectedObjectId ? { objectId: selectedObjectId, includeInactive: true } : { includeInactive: true }
      )
    : [];

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
        actorRole={profile.role}
        actorId={profile.id}
        canCreate={canCreate}
        canManage={canManage}
        initialFilterObjectId={selectedObjectId}
      />
    </section>
  );
}
