import { requireProfile } from "@/lib/auth";
import { canAccessWarehouseModule } from "@/lib/capabilities";
import { listStockLocationsForProfile, listWarehouseReadableObjectsForProfile } from "@/lib/warehouse/queries";
import { PageHeader } from "@/components/ui/page-header";
import { BackButton } from "@/components/ui/back-button";
import { StockLocationsAdmin } from "@/components/warehouse/stock-locations-admin";

export default async function WarehouseLocationsPage({
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
  const locations = await listStockLocationsForProfile(supabase, profile, selectedObjectId ? { objectId: selectedObjectId } : {});

  return (
    <section className="grid">
      <PageHeader
        title="Склад: места хранения"
        description="Шкафы, кладовые, стеллажи и другие места хранения с QR-кодами."
        actions={<BackButton fallback="/warehouse/items" />}
      />
      <StockLocationsAdmin
        locations={locations}
        objects={objects.map((item) => ({ id: item.id, name: item.name }))}
        initialFilterObjectId={selectedObjectId}
      />
    </section>
  );
}
