import { requireProfile } from "@/lib/auth";
import { canAccessWarehouseModule, canManageWarehouseCatalog } from "@/lib/capabilities";
import { listPprSystemGroups, listPprWorkTemplatesForWarehouse } from "@/lib/ppr/structure-queries";
import {
  listStockItemsForProfile,
  listStockLocationsForProfile,
  listWarehouseObjectSummariesForProfile,
  listWarehouseReadableObjectsForProfile,
} from "@/lib/warehouse/queries";
import { PageHeader } from "@/components/ui/page-header";
import { BackButton } from "@/components/ui/back-button";
import { StockItemsAdmin } from "@/components/warehouse/stock-items-admin";
import { WarehouseItemsObjectHub } from "@/components/warehouse/warehouse-items-object-hub";

export default async function WarehouseItemsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const search = searchParams ? await searchParams : {};
  const { profile, supabase } = await requireProfile();

  if (!canAccessWarehouseModule(profile.role)) {
    return <div className="empty-state">Доступ к складу запрещён.</div>;
  }

  const objects = await listWarehouseReadableObjectsForProfile(supabase, profile);
  const showAllObjects = typeof search.showAll === "string" && search.showAll === "1";
  const requestedObjectId = typeof search.objectId === "string" ? search.objectId : "";
  const selectedObject = objects.find((item) => item.id === requestedObjectId) ?? null;
  const selectedObjectId = selectedObject?.id ?? "";
  const isAllObjectsMode = !selectedObject && showAllObjects;
  const shouldShowCatalog = Boolean(selectedObject) || isAllObjectsMode;
  const canManage = canManageWarehouseCatalog(profile.role);
  const [items, locations, systemGroups, pprTemplates, summaries] = await Promise.all([
    shouldShowCatalog ? listStockItemsForProfile(supabase, profile, selectedObjectId ? { objectId: selectedObjectId } : {}) : Promise.resolve([]),
    shouldShowCatalog
      ? listStockLocationsForProfile(supabase, profile, selectedObjectId ? { objectId: selectedObjectId } : {})
      : Promise.resolve([]),
    shouldShowCatalog && canManage ? listPprSystemGroups(supabase, profile) : Promise.resolve([]),
    shouldShowCatalog && canManage
      ? listPprWorkTemplatesForWarehouse(supabase, selectedObjectId ? { objectId: selectedObjectId } : {})
      : Promise.resolve([]),
    shouldShowCatalog ? Promise.resolve([]) : listWarehouseObjectSummariesForProfile(supabase, profile),
  ]);

  const description = selectedObject
    ? `Каталог ТМЦ по объекту «${selectedObject.name}» с быстрым переходом к местам хранения и критическим остаткам.`
    : isAllObjectsMode
      ? "Обзорный режим по всем объектам. Для повседневной работы удобнее сначала открыть конкретный объект."
      : "Сначала выберите объект, затем переходите к складам и карточкам ТМЦ внутри него.";

  return (
    <section className="grid">
      <PageHeader
        title="Склад: ТМЦ"
        description={description}
        actions={<BackButton fallback="/my" />}
      />
      {shouldShowCatalog ? (
        <StockItemsAdmin
          items={items}
          objects={objects.map((item) => ({ id: item.id, name: item.name }))}
          locations={locations.map((item) => ({ id: item.id, object_id: item.object_id, name: item.name, is_active: item.is_active }))}
          systemGroups={systemGroups}
          pprTemplates={pprTemplates}
          canManage={canManage}
          initialFilterObjectId={selectedObjectId}
          currentObject={selectedObject ? { id: selectedObject.id, name: selectedObject.name } : null}
          isAllObjectsMode={isAllObjectsMode}
        />
      ) : (
        <WarehouseItemsObjectHub summaries={summaries} />
      )}
    </section>
  );
}
