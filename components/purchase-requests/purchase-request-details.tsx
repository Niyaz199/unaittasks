"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Archive, CheckCheck, ShoppingCart, TrendingDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import {
  finalizePurchaseDraftAction,
  reassignPurchaseRequestItemAction,
  togglePurchaseRequestItemCartAction,
  updatePurchaseRequestStatusAction,
} from "@/app/actions/purchase-request-actions";
import type { PurchaseRequestDetailRow } from "@/lib/purchase-requests/queries";
import {
  purchaseRequestExecutorMeta,
  purchaseRequestKindMeta,
  purchaseRequestStatusMeta,
} from "@/lib/purchase-requests/presentation";
import type { Role } from "@/lib/types";

function resolveName(raw: { name: string } | Array<{ name: string }> | null | undefined) {
  if (Array.isArray(raw)) return raw[0]?.name ?? "—";
  return raw?.name ?? "—";
}

function resolveUser(raw: { full_name: string } | Array<{ full_name: string }> | null | undefined) {
  if (Array.isArray(raw)) return raw[0]?.full_name ?? "—";
  return raw?.full_name ?? "—";
}

function resolveSystemName(
  raw: { name: string } | Array<{ name: string }> | null | undefined
): string {
  if (Array.isArray(raw)) return raw[0]?.name ?? "";
  return raw?.name ?? "";
}

function resolveStockItem(
  raw:
    | { name: string; unit: string; sku?: string | null; kind?: string; procurement_method?: string | null }
    | Array<{ name: string; unit: string; sku?: string | null; kind?: string; procurement_method?: string | null }>
    | null
    | undefined
) {
  if (Array.isArray(raw)) return raw[0] ?? null;
  return raw ?? null;
}

function formatQty(value: number, unit: string) {
  return `${Number(value).toLocaleString("ru-RU", { maximumFractionDigits: 3 })} ${unit}`;
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("ru-RU");
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleString("ru-RU");
}

function getCartActionCopy(executorRole: PurchaseRequestDetailRow["executor_role"] | "engineer" | "procurement_manager" | null) {
  if (executorRole === "procurement_manager") {
    return {
      inactive: "Отметить как заказанное",
      active: "Уже заказано",
      hint: "Быстрая пометка для менеджера, что позиция уже ушла в заказ.",
    };
  }

  return {
    inactive: "Добавить в корзину",
    active: "Уже в корзине",
    hint: "Крупная отметка для инженера, когда позиция уже подобрана в магазине.",
  };
}

export function PurchaseRequestDetails({
  request,
  actorRole,
  actorId,
  canManage,
}: {
  request: PurchaseRequestDetailRow;
  actorRole: Role;
  actorId: string;
  canManage: boolean;
}) {
  const router = useRouter();
  const { addToast } = useToast();
  const [pending, startTransition] = useTransition();

  const statusMeta = purchaseRequestStatusMeta[request.status];
  const kindMeta = purchaseRequestKindMeta[request.request_kind];
  const executorMeta = request.executor_role ? purchaseRequestExecutorMeta[request.executor_role] : null;
  const isArchivedRequest = request.status === "fulfilled" || request.status === "cancelled";
  const canReassignWarehouseItems =
    canManage &&
    actorRole !== "procurement_manager" &&
    request.source === "warehouse_daily" &&
    !isArchivedRequest;
  const canWorkFinalRequest =
    canManage &&
    request.request_kind === "final" &&
    (actorRole !== "procurement_manager" ||
      (request.executor_role === "procurement_manager" && request.assigned_to === actorId));
  const archiveDate = request.status === "fulfilled" ? request.fulfilled_at ?? request.updated_at : request.cancelled_at ?? request.updated_at;
  const archiveSummaryLabel = request.status === "fulfilled" ? "Заявка завершена" : "Заявка отменена";

  const totalItems = request.items?.length ?? 0;
  const cartCount = (request.items ?? []).filter((i) => i.in_cart).length;
  const cartProgress = totalItems > 0 ? Math.round((cartCount / totalItems) * 100) : 0;

  async function runAction(
    action: () => Promise<void>,
    successMessage: string,
    errorMessage: string
  ) {
    startTransition(async () => {
      try {
        await action();
        addToast(successMessage, "success");
        router.refresh();
      } catch (error) {
        addToast(error instanceof Error ? error.message : errorMessage, "error");
      }
    });
  }

  function changeStatus(status: "new" | "in_progress" | "fulfilled" | "cancelled") {
    return runAction(
      async () => {
        const formData = new FormData();
        formData.set("request_id", request.id);
        formData.set("status", status);
        await updatePurchaseRequestStatusAction(formData);
      },
      "Статус заявки обновлён",
      "Не удалось обновить статус"
    );
  }

  function finalizeDraft() {
    return runAction(
      async () => {
        const formData = new FormData();
        formData.set("request_id", request.id);
        await finalizePurchaseDraftAction(formData);
      },
      "Итоговые заявки сформированы",
      "Не удалось обработать черновик"
    );
  }

  function reassignItem(itemId: string, targetRole: "engineer" | "procurement_manager") {
    return runAction(
      async () => {
        const formData = new FormData();
        formData.set("item_id", itemId);
        formData.set("target_role", targetRole);
        await reassignPurchaseRequestItemAction(formData);
      },
      "Позиция перераспределена",
      "Не удалось перераспределить позицию"
    );
  }

  function toggleCart(itemId: string, inCart: boolean) {
    return runAction(
      async () => {
        const formData = new FormData();
        formData.set("item_id", itemId);
        formData.set("in_cart", String(inCart));
        await togglePurchaseRequestItemCartAction(formData);
      },
      inCart ? "Позиция отмечена в корзине" : "Позиция снята из корзины",
      "Не удалось обновить позицию"
    );
  }

  return (
    <section className="grid" style={{ gap: "1rem" }}>
      <div className="section-card purchase-request-detail-hero">
        <div className="purchase-request-detail-head">
          <div className="grid" style={{ gap: "0.4rem" }}>
            <div className="text-soft">
              {resolveName(request.object)}
              {request.request_kind === "draft" && request.draft_date ? ` • Черновик на ${formatDate(request.draft_date)}` : ""}
            </div>
            <h2 style={{ margin: 0, fontSize: "1.55rem" }}>
              {request.description?.trim() || "Заявка на закупку"}
            </h2>
            <div className="text-soft">
              Инициатор: {resolveUser(request.requester)}
              {request.assignee ? ` • Исполнитель: ${resolveUser(request.assignee)}` : ""}
            </div>
          </div>

          <div className="row" style={{ gap: "0.35rem", flexWrap: "wrap", justifyContent: "flex-end" }}>
            <Badge tone={request.request_kind === "draft" ? "warning" : "info"}>{kindMeta.label}</Badge>
            {request.request_kind === "final" ? <Badge tone={statusMeta.tone}>{statusMeta.label}</Badge> : null}
            {request.source === "warehouse_daily" ? (
              <Badge tone="danger">Из ежедневного дефицита</Badge>
            ) : request.source === "ppr" ? (
              <Badge tone="info">
                Из плана ППР{request.ppr_plan_month ? ` · ${String(request.ppr_plan_month).slice(0, 7)}` : ""}
              </Badge>
            ) : (
              <Badge tone="info">Ручная заявка</Badge>
            )}
            {executorMeta ? <Badge tone="neutral">{executorMeta.label}</Badge> : null}
          </div>
        </div>

        <div className="purchase-request-meta-compact">
          <div className="purchase-request-detail-meta-item">
            <span className="text-soft">Создана</span>
            <strong>{formatDateTime(request.created_at)}</strong>
          </div>
          <div className="purchase-request-detail-meta-item">
            <span className="text-soft">Позиции</span>
            <strong>
              {totalItems}
              {request.request_kind === "final" && totalItems > 0
                ? ` · ${cartCount} в корзине`
                : ""}
            </strong>
          </div>
        </div>

        {request.request_kind === "draft" ? (
          <div className="purchase-request-workbench">
            <div className="purchase-request-workbench-copy">
              <strong>Разбор черновика</strong>
              <span className="text-soft">Для каждой позиции ниже укажите, кто закупает. Затем нажмите «Сформировать заявки».</span>
            </div>
          </div>
        ) : isArchivedRequest ? (
          <div className="purchase-request-workbench is-archived">
            <div className="purchase-request-workbench-copy">
              <div className="purchase-request-workbench-title">
                <Archive size={18} aria-hidden="true" />
                <strong>{archiveSummaryLabel}</strong>
              </div>
              <span className="text-soft">
                {request.status === "fulfilled"
                  ? `Закрыта как закупленная ${formatDateTime(archiveDate)}.`
                  : `Отменена ${formatDateTime(archiveDate)}.`}
              </span>
            </div>
            <Badge tone={statusMeta.tone}>{statusMeta.label}</Badge>
          </div>
        ) : (
          <div className="purchase-request-workbench">
            <div className="purchase-request-workbench-copy">
              <strong>Текущий этап закупки</strong>
              {totalItems > 0 ? (
                <div className="purchase-request-progress" style={{ marginTop: "0.35rem" }}>
                  <div className="purchase-request-progress-bar">
                    <div className="purchase-request-progress-fill" style={{ width: `${cartProgress}%` }} />
                  </div>
                  <span>{cartCount} из {totalItems} в корзине</span>
                </div>
              ) : null}
            </div>
            {canWorkFinalRequest ? (
              <div className="purchase-request-status-actions">
                {request.status === "new" ? (
                  <button className="btn btn-ghost ppr-action-btn" type="button" onClick={() => changeStatus("in_progress")} disabled={pending}>
                    В работу
                  </button>
                ) : null}
                {(request.status === "new" || request.status === "in_progress") ? (
                  <button className="btn btn-accent ppr-action-btn" type="button" onClick={() => changeStatus("fulfilled")} disabled={pending}>
                    Закуплено
                  </button>
                ) : null}
                {request.status !== "cancelled" && request.status !== "fulfilled" ? (
                  <button className="btn btn-ghost ppr-action-btn" type="button" onClick={() => changeStatus("cancelled")} disabled={pending}>
                    Отменить
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
        )}
      </div>

      <div className="section-card grid" style={{ gap: "1rem" }}>
        <div className="purchase-request-section-title">
          Состав заявки · {totalItems} {totalItems === 1 ? "позиция" : totalItems >= 2 && totalItems <= 4 ? "позиции" : "позиций"}
        </div>

        <div className="grid" style={{ gap: "0.85rem" }}>
          {request.source === "ppr"
            ? (() => {
                const groups = new Map<string, { name: string; items: NonNullable<typeof request.items> }>();
                for (const it of request.items ?? []) {
                  const key = it.ppr_system_id ?? "__no_system__";
                  const name = resolveSystemName(it.ppr_system) || "Без системы";
                  const group = groups.get(key) ?? { name, items: [] };
                  group.items.push(it);
                  groups.set(key, group);
                }
                return [...groups.entries()].map(([key, group]) => (
                  <div key={key} className="grid" style={{ gap: "0.5rem" }}>
                    <div className="purchase-request-section-title" style={{ fontSize: "0.92rem", opacity: 0.85 }}>
                      Система: {group.name}
                    </div>
                    {group.items.map((item) => renderRequestItem(item))}
                  </div>
                ));
              })()
            : (request.items ?? []).map((item) => renderRequestItem(item))}

          {!request.items?.length ? <div className="text-soft">В этой заявке пока нет позиций.</div> : null}

          {request.request_kind === "draft" && canManage && actorRole !== "procurement_manager" && !request.processed_at && totalItems > 0 ? (
            <div className="purchase-request-finalize-cta">
              <div className="purchase-request-finalize-hint">
                Распределите позиции выше, затем зафиксируйте заявки
              </div>
              <button
                className="btn btn-accent purchase-request-finalize-btn"
                type="button"
                onClick={finalizeDraft}
                disabled={pending}
              >
                {pending ? "Формируем..." : "✓ Сформировать итоговые заявки"}
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );

  function renderRequestItem(item: NonNullable<PurchaseRequestDetailRow["items"]>[number]) {
    const stockItem = resolveStockItem(item.stock_item);
    const effectiveRole = item.assigned_role ?? request.executor_role ?? "engineer";
    const cartCopy = getCartActionCopy(effectiveRole);

    return (
              <div key={item.id} className={`purchase-request-detail-item ${isArchivedRequest ? "is-archived" : ""}`}>

                {/* Primary row: name + qty chip */}
                <div className="purchase-request-item-name-row">
                  <div className="purchase-request-item-name">{item.title}</div>
                  <div className="purchase-request-item-qty-chip">
                    <span className="purchase-request-item-qty-chip-label">купить</span>
                    <span className="purchase-request-item-qty-chip-num">
                      {Number(item.quantity_requested).toLocaleString("ru-RU", { maximumFractionDigits: 3 })}
                    </span>
                    <span className="purchase-request-item-qty-chip-unit">{item.unit}</span>
                  </div>
                </div>

                {/* Secondary: stock info + badges */}
                <div className="purchase-request-item-meta-row" style={{ gap: "0.4rem" }}>
                  {item.in_cart ? (
                    <Badge tone="warning">
                      {effectiveRole === "procurement_manager" ? "Заказано" : "В корзине"}
                    </Badge>
                  ) : null}
                  {(item.current_qty_snapshot !== null || item.min_qty_snapshot !== null) ? (
                    <span className="text-soft" style={{ fontSize: "0.83rem" }}>
                      <TrendingDown size={11} style={{ display: "inline", verticalAlign: "middle", marginRight: "0.2rem" }} aria-hidden="true" />
                      Остаток: {item.current_qty_snapshot ?? 0} · Мин: {item.min_qty_snapshot ?? 0}
                      {item.location_name_snapshot ? ` · ${item.location_name_snapshot}` : ""}
                    </span>
                  ) : item.location_name_snapshot ? (
                    <span className="text-soft" style={{ fontSize: "0.83rem" }}>📦 {item.location_name_snapshot}</span>
                  ) : null}
                  {item.characteristics?.trim() ? (
                    <span className="text-soft" style={{ fontSize: "0.83rem" }}>{item.characteristics}</span>
                  ) : null}
                  {stockItem?.sku ? (
                    <span className="text-soft" style={{ fontSize: "0.83rem" }}>SKU: {stockItem.sku}</span>
                  ) : null}
                  {item.note?.trim() ? (
                    <span className="text-soft" style={{ fontSize: "0.83rem" }}>{item.note}</span>
                  ) : null}
                </div>

                {/* Cart toggle for active final requests */}
                {request.request_kind === "final" && !isArchivedRequest ? (
                  <button
                    className={`purchase-request-cart-toggle ${item.in_cart ? "is-active" : ""}`}
                    type="button"
                    disabled={!canWorkFinalRequest || pending}
                    onClick={() => toggleCart(item.id, !item.in_cart)}
                  >
                    <span className="purchase-request-cart-toggle-icon" aria-hidden="true">
                      {item.in_cart ? <CheckCheck size={20} /> : <ShoppingCart size={20} />}
                    </span>
                    <span className="purchase-request-cart-toggle-copy">
                      <span className="purchase-request-cart-toggle-title">{item.in_cart ? cartCopy.active : cartCopy.inactive}</span>
                      <span className="purchase-request-cart-toggle-hint">{cartCopy.hint}</span>
                    </span>
                  </button>
                ) : null}

                {/* Compact routing toggle for draft mode */}
                {canReassignWarehouseItems ? (
                  <div className="purchase-request-route-switch">
                    <span className="purchase-request-route-switch-label">Закупает:</span>
                    <div className="purchase-request-route-tabs" role="group" aria-label="Кто закупает позицию">
                      <button
                        className={`purchase-request-route-tab ${effectiveRole === "engineer" ? "is-active-engineer" : ""}`}
                        type="button"
                        onClick={() => reassignItem(item.id, "engineer")}
                        disabled={pending}
                      >
                        Инженер объекта
                      </button>
                      <button
                        className={`purchase-request-route-tab ${effectiveRole === "procurement_manager" ? "is-active-procurement" : ""}`}
                        type="button"
                        onClick={() => reassignItem(item.id, "procurement_manager")}
                        disabled={pending}
                      >
                        Менеджер
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
    );
  }
}
