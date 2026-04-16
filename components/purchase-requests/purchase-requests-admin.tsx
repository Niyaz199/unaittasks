"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState, useTransition } from "react";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { PprModal } from "@/components/ppr/ui/ppr-modal";
import { PprPageShell } from "@/components/ppr/ui/ppr-page-shell";
import { useToast } from "@/components/ui/toast";
import {
  purchaseRequestExecutorMeta,
  purchaseRequestKindMeta,
  purchaseRequestStatusMeta,
} from "@/lib/purchase-requests/presentation";
import {
  createPurchaseRequestAction,
  finalizePurchaseDraftAction,
  reassignPurchaseRequestItemAction,
  togglePurchaseRequestItemCartAction,
  updatePurchaseRequestStatusAction,
} from "@/app/actions/purchase-request-actions";

const PurchaseRequestForm = dynamic(
  () => import("@/components/purchase-requests/purchase-request-form").then((module) => module.PurchaseRequestForm),
  { loading: () => <div className="section-card text-soft">Загрузка...</div> }
);

type PurchaseRequestItemRow = {
  id: string;
  stock_item_id: string | null;
  title: string;
  unit: string;
  quantity_requested: number;
  note: string | null;
  is_auto_generated: boolean;
  assigned_role: "engineer" | "procurement_manager" | null;
  current_qty_snapshot: number | null;
  min_qty_snapshot: number | null;
  location_name_snapshot: string | null;
  characteristics: string | null;
  in_cart: boolean;
  cart_marked_at: string | null;
  stock_item:
    | { name: string; unit: string; sku?: string | null; kind?: string; procurement_method?: string | null }
    | Array<{ name: string; unit: string; sku?: string | null; kind?: string; procurement_method?: string | null }>
    | null;
};

type PurchaseRequestRow = {
  id: string;
  object_id: string;
  status: "new" | "in_progress" | "fulfilled" | "cancelled";
  source: "manual" | "warehouse_daily";
  request_kind: "draft" | "final";
  executor_role: "engineer" | "procurement_manager" | null;
  description: string | null;
  requested_by: string | null;
  assigned_to: string | null;
  draft_date: string | null;
  processed_at: string | null;
  origin_request_id: string | null;
  created_at: string;
  updated_at: string;
  object: { name: string } | Array<{ name: string }> | null;
  requester: { full_name: string } | Array<{ full_name: string }> | null;
  assignee: { full_name: string } | Array<{ full_name: string }> | null;
  items: PurchaseRequestItemRow[] | null;
};

type ObjectOption = { id: string; name: string };
type StockItemOption = { id: string; object_id: string; name: string; unit: string; is_active: boolean };

function resolveName(raw: { name: string } | Array<{ name: string }> | null | undefined) {
  if (Array.isArray(raw)) return raw[0]?.name ?? "—";
  return raw?.name ?? "—";
}

function resolveUser(raw: { full_name: string } | Array<{ full_name: string }> | null | undefined) {
  if (Array.isArray(raw)) return raw[0]?.full_name ?? "—";
  return raw?.full_name ?? "—";
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

export function PurchaseRequestsAdmin({
  requests,
  objects,
  stockItems,
  actorRole,
  actorId,
  canCreate,
  canManage,
  initialFilterObjectId = "",
}: {
  requests: PurchaseRequestRow[];
  objects: ObjectOption[];
  stockItems: StockItemOption[];
  actorRole: "admin" | "chief" | "lead" | "engineer" | "object_engineer" | "tech" | "procurement_manager";
  actorId: string;
  canCreate: boolean;
  canManage: boolean;
  initialFilterObjectId?: string;
}) {
  const router = useRouter();
  const { addToast } = useToast();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterObjectId, setFilterObjectId] = useState(initialFilterObjectId);
  const [filterStatus, setFilterStatus] = useState<PurchaseRequestRow["status"] | "all">("all");
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    setFilterObjectId(initialFilterObjectId);
  }, [initialFilterObjectId]);

  const filteredRequests = useMemo(() => {
    return requests.filter((request) => {
      const matchesObject = filterObjectId === "" || request.object_id === filterObjectId;
      const matchesStatus = request.request_kind === "draft" ? true : filterStatus === "all" || request.status === filterStatus;
      const search = searchTerm.trim().toLowerCase();
      const summary = (request.items ?? []).map((item) => item.title).join(" ").toLowerCase();
      const matchesSearch =
        search === "" ||
        resolveName(request.object).toLowerCase().includes(search) ||
        resolveUser(request.requester).toLowerCase().includes(search) ||
        summary.includes(search);
      return matchesObject && matchesStatus && matchesSearch;
    });
  }, [filterObjectId, filterStatus, requests, searchTerm]);

  function updateSearchParams(nextObjectId: string) {
    const params = new URLSearchParams();
    if (nextObjectId) params.set("objectId", nextObjectId);
    router.replace((`/purchase-requests${params.toString() ? `?${params.toString()}` : ""}`) as Route);
  }

  async function changeStatus(requestId: string, status: PurchaseRequestRow["status"]) {
    startTransition(async () => {
      const formData = new FormData();
      formData.set("request_id", requestId);
      formData.set("status", status);
      try {
        await updatePurchaseRequestStatusAction(formData);
        addToast("Статус заявки обновлен", "success");
      } catch (error) {
        addToast(error instanceof Error ? error.message : "Не удалось обновить статус", "error");
      }
    });
  }

  async function finalizeDraft(requestId: string) {
    startTransition(async () => {
      const formData = new FormData();
      formData.set("request_id", requestId);
      try {
        await finalizePurchaseDraftAction(formData);
        addToast("Итоговые заявки сформированы", "success");
      } catch (error) {
        addToast(error instanceof Error ? error.message : "Не удалось обработать черновик", "error");
      }
    });
  }

  async function reassignItem(itemId: string, targetRole: "engineer" | "procurement_manager") {
    startTransition(async () => {
      const formData = new FormData();
      formData.set("item_id", itemId);
      formData.set("target_role", targetRole);
      try {
        await reassignPurchaseRequestItemAction(formData);
        addToast("Позиция перераспределена", "success");
      } catch (error) {
        addToast(error instanceof Error ? error.message : "Не удалось перераспределить позицию", "error");
      }
    });
  }

  async function toggleCart(itemId: string, nextValue: boolean) {
    startTransition(async () => {
      const formData = new FormData();
      formData.set("item_id", itemId);
      formData.set("in_cart", String(nextValue));
      try {
        await togglePurchaseRequestItemCartAction(formData);
        addToast(nextValue ? "Позиция отмечена в корзине" : "Позиция снята из корзины", "success");
      } catch (error) {
        addToast(error instanceof Error ? error.message : "Не удалось обновить позицию", "error");
      }
    });
  }

  const metrics = useMemo(() => {
    const total = requests.length;
    const drafts = requests.filter((item) => item.request_kind === "draft" && !item.processed_at).length;
    const open = requests.filter((item) => item.request_kind === "final" && (item.status === "new" || item.status === "in_progress")).length;
    const completed = requests.filter((item) => item.request_kind === "final" && item.status === "fulfilled").length;
    return [
      { label: "Всего заявок", value: total, tone: "neutral" as const },
      { label: "Черновики", value: drafts, tone: "warning" as const },
      { label: "Открытые итоговые", value: open, tone: "danger" as const },
      { label: "Закуплено", value: completed, tone: "success" as const },
    ];
  }, [requests]);

  return (
    <>
      <PprPageShell
        metrics={metrics}
        onSearch={setSearchTerm}
        searchPlaceholder="Поиск по объекту, заявителю или позиции..."
        isEmpty={requests.length === 0}
        emptyState={{
          message: "Заявок на закупку пока нет",
          hint: "Здесь появятся ежедневные черновики и итоговые заявки на закупку.",
        }}
        isFilteredEmpty={filteredRequests.length === 0}
        filters={
          <>
            <select
              className="select"
              value={filterObjectId}
              onChange={(event) => {
                const nextObjectId = event.target.value;
                setFilterObjectId(nextObjectId);
                updateSearchParams(nextObjectId);
              }}
              style={{ maxWidth: "220px" }}
            >
              <option value="">Все объекты</option>
              {objects.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>

            <select className="select" value={filterStatus} onChange={(event) => setFilterStatus(event.target.value as PurchaseRequestRow["status"] | "all")}>
              <option value="all">Все статусы</option>
              {Object.entries(purchaseRequestStatusMeta).map(([key, meta]) => (
                <option key={key} value={key}>
                  {meta.label}
                </option>
              ))}
            </select>

            {canCreate ? (
              <button className="btn btn-accent" type="button" onClick={() => setIsCreateOpen(true)}>
                + Заявка
              </button>
            ) : null}
          </>
        }
      >
        <div className="grid" style={{ gap: "1rem" }}>
          {filteredRequests.map((request) => {
            const statusMeta = purchaseRequestStatusMeta[request.status];
            const kindMeta = purchaseRequestKindMeta[request.request_kind];
            const executorMeta = request.executor_role ? purchaseRequestExecutorMeta[request.executor_role] : null;

            return (
              <div key={request.id} className="section-card" style={{ display: "grid", gap: "0.9rem" }}>
                <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start", gap: "1rem", flexWrap: "wrap" }}>
                  <div className="grid" style={{ gap: "0.35rem" }}>
                    <div style={{ fontWeight: 600 }}>
                      {resolveName(request.object)}
                      {request.request_kind === "draft" && request.draft_date
                        ? ` • Черновик на ${new Date(request.draft_date).toLocaleDateString("ru-RU")}`
                        : ""}
                    </div>
                    <div className="text-soft">
                      {request.description?.trim() || "Без описания"} • {new Date(request.created_at).toLocaleString("ru-RU")}
                    </div>
                    <div className="text-soft">
                      Инициатор: {resolveUser(request.requester)}
                      {request.assignee ? ` • Исполнитель: ${resolveUser(request.assignee)}` : ""}
                    </div>
                  </div>
                  <div className="row" style={{ gap: "0.35rem", flexWrap: "wrap", justifyContent: "flex-end" }}>
                    <Badge tone={request.request_kind === "draft" ? "warning" : "info"}>{kindMeta.label}</Badge>
                    {request.request_kind === "final" ? <Badge tone={statusMeta.tone}>{statusMeta.label}</Badge> : null}
                    {request.source === "warehouse_daily" ? <Badge tone="danger">Из ежедневного дефицита</Badge> : <Badge tone="info">Ручная</Badge>}
                    {executorMeta ? <Badge tone="neutral">{executorMeta.label}</Badge> : null}
                  </div>
                </div>

                <div className="grid" style={{ gap: "0.7rem" }}>
                  {(request.items ?? []).map((item) => {
                    const stockItem = resolveStockItem(item.stock_item);
                    const effectiveRole = item.assigned_role ?? request.executor_role ?? "engineer";
                    const canRouteDraft =
                      canManage &&
                      actorRole !== "procurement_manager" &&
                      request.source === "warehouse_daily";
                    const canWorkFinalRequest =
                      canManage &&
                      request.request_kind === "final" &&
                      (actorRole !== "procurement_manager" ||
                        (request.executor_role === "procurement_manager" && request.assigned_to === actorId));
                    const canReassign = canRouteDraft;
                    const canMarkCart = canWorkFinalRequest;

                    return (
                      <div
                        key={item.id}
                        style={{
                          border: "1px solid color-mix(in srgb, var(--line) 55%, transparent)",
                          borderRadius: "16px",
                          padding: "0.9rem",
                          display: "grid",
                          gap: "0.55rem",
                        }}
                      >
                        <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start", gap: "0.75rem", flexWrap: "wrap" }}>
                          <div className="grid" style={{ gap: "0.22rem" }}>
                            <div style={{ fontWeight: 600 }}>{item.title}</div>
                            <div className="text-soft">
                              Нужно докупить: {formatQty(item.quantity_requested, item.unit)}
                              {item.location_name_snapshot ? ` • Хранение: ${item.location_name_snapshot}` : ""}
                            </div>
                            {(item.current_qty_snapshot !== null || item.min_qty_snapshot !== null) ? (
                              <div className="text-soft">
                                Остаток: {item.current_qty_snapshot ?? 0} • Минимум: {item.min_qty_snapshot ?? 0}
                              </div>
                            ) : null}
                            {item.characteristics?.trim() ? <div className="text-soft">Характеристики: {item.characteristics}</div> : null}
                            {stockItem?.sku ? <div className="text-soft">SKU: {stockItem.sku}</div> : null}
                            {item.note?.trim() ? <div className="text-soft">{item.note}</div> : null}
                          </div>

                          <div className="row" style={{ gap: "0.35rem", flexWrap: "wrap", justifyContent: "flex-end" }}>
                            <Badge tone={effectiveRole === "engineer" ? "success" : "info"}>
                              {purchaseRequestExecutorMeta[effectiveRole].label}
                            </Badge>
                            {request.request_kind === "final" ? (
                              <label className="row" style={{ gap: "0.35rem", alignItems: "center" }}>
                                <input
                                  type="checkbox"
                                  checked={item.in_cart}
                                  disabled={!canMarkCart || pending}
                                  onChange={(event) => toggleCart(item.id, event.target.checked)}
                                />
                                <span className="text-soft">В корзине</span>
                              </label>
                            ) : null}
                          </div>
                        </div>

                        {canReassign ? (
                          <div className="row" style={{ gap: "0.35rem", flexWrap: "wrap" }}>
                            <button
                              className={`btn ${effectiveRole === "engineer" ? "btn-accent" : "btn-ghost"} ppr-action-btn`}
                              type="button"
                              onClick={() => reassignItem(item.id, "engineer")}
                              disabled={pending}
                            >
                              Инженер объекта
                            </button>
                            <button
                              className={`btn ${effectiveRole === "procurement_manager" ? "btn-accent" : "btn-ghost"} ppr-action-btn`}
                              type="button"
                              onClick={() => reassignItem(item.id, "procurement_manager")}
                              disabled={pending}
                            >
                              Менеджер по закупкам
                            </button>
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>

                <div className="row" style={{ gap: "0.35rem", flexWrap: "wrap" }}>
                  {request.request_kind === "draft" && !request.processed_at && canManage && actorRole !== "procurement_manager" ? (
                    <button className="btn btn-accent ppr-action-btn" type="button" onClick={() => finalizeDraft(request.id)} disabled={pending}>
                      Сформировать итоговые заявки
                    </button>
                  ) : null}
                  {request.request_kind === "final" && ((actorRole !== "procurement_manager" && canManage) || (actorRole === "procurement_manager" && request.executor_role === "procurement_manager" && request.assigned_to === actorId)) ? (
                    <>
                      {request.status === "new" ? (
                        <button className="btn btn-ghost ppr-action-btn" type="button" onClick={() => changeStatus(request.id, "in_progress")} disabled={pending}>
                          В работу
                        </button>
                      ) : null}
                      {(request.status === "new" || request.status === "in_progress") ? (
                        <button className="btn btn-ghost ppr-action-btn" type="button" onClick={() => changeStatus(request.id, "fulfilled")} disabled={pending}>
                          Закуплено
                        </button>
                      ) : null}
                      {request.status !== "cancelled" && request.status !== "fulfilled" ? (
                        <button className="btn btn-ghost ppr-action-btn" type="button" onClick={() => changeStatus(request.id, "cancelled")} disabled={pending}>
                          Отменить
                        </button>
                      ) : null}
                    </>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </PprPageShell>

      {canCreate ? (
        <PprModal open={isCreateOpen} onClose={() => { setIsCreateOpen(false); setIsDirty(false); }} title="Новая заявка на закупку" isDirty={isDirty}>
          <PurchaseRequestForm
            action={createPurchaseRequestAction}
            objects={objects}
            stockItems={stockItems}
            onSubmitted={() => { setIsCreateOpen(false); setIsDirty(false); }}
            onChange={() => setIsDirty(true)}
            submitLabel="Создать"
          />
        </PprModal>
      ) : null}
    </>
  );
}
