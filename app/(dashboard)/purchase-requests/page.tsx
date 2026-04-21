import { requireProfile } from "@/lib/auth";
import { canAccessPurchaseRequestsModule, canCreatePurchaseRequests } from "@/lib/capabilities";
import {
  listPurchaseRequestsForProfile,
  listPurchaseRequestCreatableObjectsForProfile,
  listPurchaseRequestReadableObjectsForProfile,
  type PurchaseRequestArchiveMode,
  type PurchaseRequestFlow,
} from "@/lib/purchase-requests/queries";
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
  const requestedFlow = typeof search.flow === "string" ? search.flow : "";
  const requestedDate = typeof search.date === "string" ? search.date : "";
  const archiveMode: PurchaseRequestArchiveMode = search.archive === "1" ? "archived" : "active";
  const canCreate = canCreatePurchaseRequests(profile.role);
  const readableObjects = await listPurchaseRequestReadableObjectsForProfile(supabase, profile);
  const selectedObjectId = readableObjects.some((item) => item.id === requestedObjectId) ? requestedObjectId : "";
  const requests = await listPurchaseRequestsForProfile(supabase, profile, {
    archiveMode,
    ...(selectedObjectId ? { objectId: selectedObjectId } : {}),
  });
  const flowCounts = requests.reduce(
    (acc, request) => {
      if (request.source === "warehouse_daily") {
        acc.warehouse_daily += 1;
      } else {
        acc.engineer_requests += 1;
      }
      return acc;
    },
    {
      engineer_requests: 0,
      warehouse_daily: 0,
      ppr: 0,
    } satisfies Record<PurchaseRequestFlow, number>
  );
  const initialFlow: PurchaseRequestFlow =
    requestedFlow === "warehouse_daily" || requestedFlow === "ppr"
      ? requestedFlow
      : flowCounts.engineer_requests > 0
        ? "engineer_requests"
        : flowCounts.warehouse_daily > 0
          ? "warehouse_daily"
          : "engineer_requests";
  const creatableObjects = canCreate ? await listPurchaseRequestCreatableObjectsForProfile(supabase, profile) : [];
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
        filterObjects={readableObjects.map((item) => ({ id: item.id, name: item.name }))}
        createObjects={creatableObjects.map((item) => ({ id: item.id, name: item.name }))}
        stockItems={stockItems.map((item) => ({ id: item.id, object_id: item.object_id, name: item.name, unit: item.unit, is_active: item.is_active }))}
        actorRole={profile.role}
        canCreate={canCreate}
        initialFilterObjectId={selectedObjectId}
        initialFlow={initialFlow}
        initialArchiveMode={archiveMode}
        initialFilterDate={requestedDate}
      />
    </section>
  );
}
