import { notFound } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { canAccessWarehouseModule, canManageWarehouseCatalog } from "@/lib/capabilities";
import { hasActorScopedObjectAccessForProfile } from "@/lib/access/object-scope";
import { isGlobalObjectScopeRole } from "@/lib/access/matrix";
import {
  getStockItemByIdForProfile,
  listStockLocationsForProfile,
  listWarehouseReadableObjectsForProfile,
} from "@/lib/warehouse/queries";
import { listPprSystemGroups, listPprWorkTemplatesForWarehouse } from "@/lib/ppr/structure-queries";
import { PageHeader } from "@/components/ui/page-header";
import { BackButton } from "@/components/ui/back-button";
import { StockItemDetailsView } from "@/components/warehouse/stock-item-details";

export default async function StockItemDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { profile, supabase } = await requireProfile();

  if (!canAccessWarehouseModule(profile.role)) {
    return <div className="empty-state">Доступ к складу запрещён.</div>;
  }

  const details = await getStockItemByIdForProfile(supabase, profile, id);
  if (!details) notFound();

  const objectId = details.item.object_id;

  // canManage по роли + по доступу к объекту: иначе кнопки «Редактировать» /
  // «Загрузить» / «Удалить» отрисуются и приведут к 403 на сервере.
  const roleCanManage = canManageWarehouseCatalog(profile.role);
  const hasObjectScope =
    isGlobalObjectScopeRole(profile.role) ||
    (await hasActorScopedObjectAccessForProfile(supabase, profile, objectId));
  const canManage = roleCanManage && hasObjectScope;

  // Данные для формы редактирования. Подгружаем только если пользователь может
  // редактировать — иначе пустые массивы экономят запросы.
  const [objects, locations, systemGroups, pprTemplates] = canManage
    ? await Promise.all([
        listWarehouseReadableObjectsForProfile(supabase, profile),
        listStockLocationsForProfile(supabase, profile, { objectId }),
        listPprSystemGroups(supabase, profile),
        listPprWorkTemplatesForWarehouse(supabase, { objectId }),
      ])
    : [[], [], [], []];

  return (
    <section className="grid">
      <PageHeader
        title="Карточка ТМЦ"
        description="Подробная карточка с характеристиками, документами, движением и оборудованием, в котором используется позиция."
        actions={<BackButton fallback="/warehouse/items" />}
      />
      <StockItemDetailsView
        details={details}
        canManage={canManage}
        objects={objects}
        locations={locations.map((l) => ({
          id: l.id,
          object_id: l.object_id,
          name: l.name,
          is_active: l.is_active,
        }))}
        systemGroups={systemGroups}
        pprTemplates={pprTemplates.map((t) => ({
          id: t.id,
          name: t.name,
          object_id: t.object_id,
          system_id: t.system_id,
          system_group_id: t.system_group_id,
        }))}
      />
    </section>
  );
}
