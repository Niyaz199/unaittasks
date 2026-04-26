import { requireProfile } from "@/lib/auth";
import { canAccessWarehouseModule } from "@/lib/capabilities";
import { listObjectRoomsForProfile } from "@/lib/object-rooms";
import { listPprSystemsForProfile } from "@/lib/ppr/structure-queries";
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
  const initialCreateOpen = search.new === "1";
  const [locations, systems, rooms] = await Promise.all([
    listStockLocationsForProfile(supabase, profile, selectedObjectId ? { objectId: selectedObjectId } : {}),
    listPprSystemsForProfile(supabase, profile, selectedObjectId ? { objectId: selectedObjectId } : {}),
    listObjectRoomsForProfile(supabase, profile, selectedObjectId ? { objectId: selectedObjectId } : {}),
  ]);

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
        systems={systems.map((item) => ({ id: item.id, object_id: item.object_id, name: item.name, is_active: item.is_active }))}
        rooms={rooms.map((item) => ({ id: item.id, object_id: item.object_id, name: item.name, is_active: item.is_active }))}
        initialFilterObjectId={selectedObjectId}
        initialCreateOpen={initialCreateOpen}
      />
    </section>
  );
}
