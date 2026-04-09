import { requireProfile } from "@/lib/auth";
import { canAccessWarehouseModule } from "@/lib/capabilities";
import { listStockItemsForProfile, listWarehouseReadableObjectsForProfile } from "@/lib/warehouse/queries";
import { PageHeader } from "@/components/ui/page-header";
import { BackButton } from "@/components/ui/back-button";
import { StockItemsAdmin } from "@/components/warehouse/stock-items-admin";

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
  const requestedObjectId = typeof search.objectId === "string" ? search.objectId : "";
  const selectedObjectId = objects.some((item) => item.id === requestedObjectId) ? requestedObjectId : "";
  const items = await listStockItemsForProfile(supabase, profile, selectedObjectId ? { objectId: selectedObjectId } : {});

  return (
    <section className="grid">
      <PageHeader
        title="Склад: ТМЦ"
        description="Каталог материалов, расходников и запасных частей по объектам."
        actions={<BackButton fallback="/my" />}
      />
      <StockItemsAdmin
        items={items}
        objects={objects.map((item) => ({ id: item.id, name: item.name }))}
        initialFilterObjectId={selectedObjectId}
      />
    </section>
  );
}
