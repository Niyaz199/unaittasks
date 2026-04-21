"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import type { Route } from "next";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { PprModal } from "@/components/ppr/ui/ppr-modal";
import { PprPageShell } from "@/components/ppr/ui/ppr-page-shell";
import { Badge } from "@/components/ui/badge";
import { createPurchaseRequestAction } from "@/app/actions/purchase-request-actions";
import {
  type PurchaseRequestArchiveMode,
  type PurchaseRequestFlow,
  type PurchaseRequestSummaryRow,
} from "@/lib/purchase-requests/queries";
import {
  purchaseRequestExecutorMeta,
  purchaseRequestKindMeta,
  purchaseRequestStatusMeta,
} from "@/lib/purchase-requests/presentation";
import type { Role } from "@/lib/types";

const PurchaseRequestForm = dynamic(
  () => import("@/components/purchase-requests/purchase-request-form").then((module) => module.PurchaseRequestForm),
  { loading: () => <div className="section-card text-soft">Загрузка...</div> }
);

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

function getRequestFlow(request: Pick<PurchaseRequestSummaryRow, "source">): Exclude<PurchaseRequestFlow, "ppr"> {
  return request.source === "warehouse_daily" ? "warehouse_daily" : "engineer_requests";
}

function formatRequestDate(value: string | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("ru-RU");
}

function formatRequestDateTime(value: string) {
  return new Date(value).toLocaleString("ru-RU");
}

function getCardAccentClass(request: Pick<PurchaseRequestSummaryRow, "request_kind" | "status">): string {
  if (request.request_kind === "draft") return "is-draft";
  if (request.status === "in_progress") return "is-in-progress";
  if (request.status === "new") return "is-new";
  return "";
}

function toDateInputValue(value: string | null | undefined) {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  const year = parsed.getFullYear();
  const month = `${parsed.getMonth() + 1}`.padStart(2, "0");
  const day = `${parsed.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getRequestDateKey(request: Pick<PurchaseRequestSummaryRow, "draft_date" | "created_at">) {
  return request.draft_date ? toDateInputValue(request.draft_date) : toDateInputValue(request.created_at);
}

function flowLabel(flow: PurchaseRequestFlow) {
  switch (flow) {
    case "engineer_requests":
      return "Заявки инженеров";
    case "warehouse_daily":
      return "Ежедневные заявки по остатку на складе";
    case "ppr":
      return "Заявки ППР";
  }
}

function buildListHref(params: {
  objectId: string;
  flow: PurchaseRequestFlow;
  archiveMode: PurchaseRequestArchiveMode;
  showFlowSwitch: boolean;
  requestDate: string;
}) {
  const search = new URLSearchParams();
  if (params.objectId) search.set("objectId", params.objectId);
  if (params.showFlowSwitch && params.flow !== "engineer_requests") search.set("flow", params.flow);
  if (params.archiveMode === "archived") search.set("archive", "1");
  if (params.requestDate) search.set("date", params.requestDate);
  return `/purchase-requests${search.toString() ? `?${search.toString()}` : ""}`;
}

function groupVisibleRequests(
  requests: PurchaseRequestSummaryRow[],
  flow: PurchaseRequestFlow,
  archiveMode: PurchaseRequestArchiveMode
) {
  if (archiveMode === "archived") {
    return [{ id: "archive", title: "Архив", hint: "Закупленные и отменённые заявки.", requests }];
  }

  if (flow === "warehouse_daily") {
    return [
      {
        id: "drafts",
        title: "Черновики на согласование",
        hint: "Общая ежедневная подборка дефицита до разнесения по исполнителям.",
        requests: requests.filter((request) => request.request_kind === "draft"),
      },
      {
        id: "finals",
        title: "Активные итоговые заявки",
        hint: "Сформированные ежедневные заявки по остаткам на складе.",
        requests: requests.filter((request) => request.request_kind === "final"),
      },
    ].filter((group) => group.requests.length > 0);
  }

  return [
    {
      id: "main",
      title: flow === "engineer_requests" ? "Активные заявки инженеров" : "Список заявок",
      hint:
        flow === "engineer_requests"
          ? "Ручные заявки и потребности, созданные сотрудниками."
          : "Текущий реестр заявок.",
      requests,
    },
  ];
}

function getArchiveRequestSummary(request: Pick<PurchaseRequestSummaryRow, "status" | "fulfilled_at" | "cancelled_at" | "updated_at">) {
  if (request.status === "fulfilled") {
    return `Закуплено ${formatRequestDateTime(request.fulfilled_at ?? request.updated_at)}`;
  }
  if (request.status === "cancelled") {
    return `Отменено ${formatRequestDateTime(request.cancelled_at ?? request.updated_at)}`;
  }
  return `Обновлено ${formatRequestDateTime(request.updated_at)}`;
}

export function PurchaseRequestsAdmin({
  requests,
  filterObjects,
  createObjects,
  stockItems,
  actorRole,
  canCreate,
  initialFilterObjectId = "",
  initialFlow = "engineer_requests",
  initialArchiveMode = "active",
  initialFilterDate = "",
}: {
  requests: PurchaseRequestSummaryRow[];
  filterObjects: ObjectOption[];
  createObjects: ObjectOption[];
  stockItems: StockItemOption[];
  actorRole: Role;
  canCreate: boolean;
  initialFilterObjectId?: string;
  initialFlow?: PurchaseRequestFlow;
  initialArchiveMode?: PurchaseRequestArchiveMode;
  initialFilterDate?: string;
}) {
  const router = useRouter();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterObjectId, setFilterObjectId] = useState(initialFilterObjectId);
  const [archiveMode, setArchiveMode] = useState<PurchaseRequestArchiveMode>(initialArchiveMode);
  const [selectedFlow, setSelectedFlow] = useState<PurchaseRequestFlow>(initialFlow);
  const [filterDate, setFilterDate] = useState(initialFilterDate);

  const showFlowSwitch = actorRole !== "engineer" && actorRole !== "tech";

  useEffect(() => {
    setFilterObjectId(initialFilterObjectId);
  }, [initialFilterObjectId]);

  useEffect(() => {
    setArchiveMode(initialArchiveMode);
  }, [initialArchiveMode]);

  useEffect(() => {
    setSelectedFlow(initialFlow);
  }, [initialFlow]);

  useEffect(() => {
    setFilterDate(initialFilterDate);
  }, [initialFilterDate]);

  const dateFilteredRequests = useMemo(() => {
    if (!filterDate) return requests;
    return requests.filter((request) => getRequestDateKey(request) === filterDate);
  }, [filterDate, requests]);

  const counts = useMemo(() => {
    return dateFilteredRequests.reduce(
      (acc, request) => {
        const flow = getRequestFlow(request);
        acc[flow] += 1;
        return acc;
      },
      {
        engineer_requests: 0,
        warehouse_daily: 0,
        ppr: 0,
      } satisfies Record<PurchaseRequestFlow, number>
    );
  }, [dateFilteredRequests]);

  const visibleRequests = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    return dateFilteredRequests.filter((request) => {
      if (showFlowSwitch && selectedFlow !== "ppr" && getRequestFlow(request) !== selectedFlow) {
        return false;
      }
      if (showFlowSwitch && selectedFlow === "ppr") {
        return false;
      }
      if (!normalizedSearch) return true;
      const searchableText = [
        resolveName(request.object),
        resolveUser(request.requester),
        resolveUser(request.assignee),
        request.description ?? "",
        ...(request.preview_items ?? []),
      ]
        .join(" ")
        .toLowerCase();
      return searchableText.includes(normalizedSearch);
    });
  }, [dateFilteredRequests, searchTerm, selectedFlow, showFlowSwitch]);

  const sections = useMemo(
    () => groupVisibleRequests(visibleRequests, selectedFlow, archiveMode),
    [archiveMode, selectedFlow, visibleRequests]
  );

  const metrics = useMemo(() => {
    const drafts = dateFilteredRequests.filter((item) => item.request_kind === "draft").length;
    const finals = dateFilteredRequests.filter((item) => item.request_kind === "final").length;
    return [
      { label: archiveMode === "archived" ? "В архиве" : "В работе", value: dateFilteredRequests.length, tone: "neutral" as const },
      { label: "Ручные", value: counts.engineer_requests, tone: "info" as const },
      { label: "Ежедневные", value: counts.warehouse_daily, tone: "warning" as const },
      { label: archiveMode === "archived" ? "Итоговые" : "Черновики", value: archiveMode === "archived" ? finals : drafts, tone: "success" as const },
    ];
  }, [archiveMode, counts.engineer_requests, counts.warehouse_daily, dateFilteredRequests]);

  function updateSearchParams(next: Partial<{ objectId: string; archiveMode: PurchaseRequestArchiveMode; flow: PurchaseRequestFlow; requestDate: string }>) {
    const href = buildListHref({
      objectId: next.objectId ?? filterObjectId,
      archiveMode: next.archiveMode ?? archiveMode,
      flow: next.flow ?? selectedFlow,
      showFlowSwitch,
      requestDate: next.requestDate ?? filterDate,
    });
    router.replace(href as Route);
  }

  const currentListHref = buildListHref({
    objectId: filterObjectId,
    archiveMode,
    flow: selectedFlow,
    showFlowSwitch,
    requestDate: filterDate,
  });

  const emptyState =
    archiveMode === "archived"
      ? {
          message: "Архив заявок пока пуст",
          hint: "Здесь появятся закупленные и отменённые заявки по выбранному потоку.",
        }
      : {
          message: "Активных заявок на закупку сейчас нет",
          hint:
            selectedFlow === "warehouse_daily"
              ? "Здесь будут ежедневные черновики и итоговые заявки по остаткам склада."
              : "Здесь будут ручные заявки сотрудников и инженеров.",
        };
  const filteredEmptyState =
    selectedFlow === "ppr"
      ? {
          message: archiveMode === "archived" ? "Архив ППР-заявок пока пуст" : "Заявок ППР пока нет",
          hint: "Этот раздел зарезервирован под будущий поток закупок из ППР.",
        }
      : archiveMode === "archived"
        ? {
            message: "В этом архивном разделе пока нет заявок",
            hint: "Переключитесь на другой поток или объект, чтобы посмотреть другие архивные заявки.",
          }
        : {
            message: "В этом разделе пока нет активных заявок",
            hint: "Переключитесь на другой поток или объект, чтобы посмотреть другие заявки.",
          };

  return (
    <>
      <PprPageShell
        metrics={metrics}
        onSearch={setSearchTerm}
        searchPlaceholder="Поиск по объекту, инициатору или позиции..."
        isEmpty={dateFilteredRequests.length === 0}
        emptyState={emptyState}
        isFilteredEmpty={visibleRequests.length === 0}
        keepChildrenWhenEmpty
        keepChildrenWhenFilteredEmpty
        filteredEmptyState={filteredEmptyState}
        filters={
          <>
            <select
              className="select"
              value={filterObjectId}
              onChange={(event) => {
                const nextObjectId = event.target.value;
                setFilterObjectId(nextObjectId);
                updateSearchParams({ objectId: nextObjectId });
              }}
              style={{ maxWidth: "240px" }}
            >
              <option value="">Все объекты</option>
              {filterObjects.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>

            <input
              className="input"
              type="date"
              value={filterDate}
              onChange={(event) => {
                const nextDate = event.target.value;
                setFilterDate(nextDate);
                updateSearchParams({ requestDate: nextDate });
              }}
              style={{ maxWidth: "190px" }}
              aria-label="Фильтр по дате заявки"
            />

            {filterDate ? (
              <button
                className="btn btn-ghost"
                type="button"
                onClick={() => {
                  setFilterDate("");
                  updateSearchParams({ requestDate: "" });
                }}
              >
                Все даты
              </button>
            ) : null}

            <div className="warehouse-view-switch" role="tablist" aria-label="Режим списка заявок">
              {([
                { id: "active", label: "Активные" },
                { id: "archived", label: "Архив" },
              ] as const).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  className={`warehouse-view-tab ${archiveMode === tab.id ? "is-active" : ""}`}
                  onClick={() => {
                    setArchiveMode(tab.id);
                    updateSearchParams({ archiveMode: tab.id });
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {canCreate ? (
              <button className="btn btn-accent" type="button" onClick={() => setIsCreateOpen(true)}>
                + Заявка
              </button>
            ) : null}
          </>
        }
      >
        {showFlowSwitch ? (
          <div className="warehouse-view-switch" role="tablist" aria-label="Потоки заявок на закупку">
            {([
              { id: "engineer_requests", label: "Заявки инженеров", count: counts.engineer_requests },
              { id: "warehouse_daily", label: "Ежедневные заявки по остатку на складе", count: counts.warehouse_daily },
              { id: "ppr", label: "Заявки ППР", count: counts.ppr },
            ] as const).map((tab) => (
              <button
                key={tab.id}
                type="button"
                className={`warehouse-view-tab ${selectedFlow === tab.id ? "is-active" : ""}`}
                onClick={() => {
                  setSelectedFlow(tab.id);
                  updateSearchParams({ flow: tab.id });
                }}
              >
                <span>{tab.label}</span>
                <span className="warehouse-view-tab-count">{tab.count}</span>
              </button>
            ))}
          </div>
        ) : null}

        <div className="grid" style={{ gap: "1.25rem" }}>
          {sections.map((section) => (
            <div key={section.id} className="grid" style={{ gap: "0.65rem" }}>
              <div className="purchase-request-section-title">{section.title}</div>

              <div className="grid purchase-request-list-grid">
                {section.requests.map((request) => {
                  const statusMeta = purchaseRequestStatusMeta[request.status];
                  const executorMeta = request.executor_role ? purchaseRequestExecutorMeta[request.executor_role] : null;
                  const detailsHref = `${`/purchase-requests/${request.id}`}${`?from=${encodeURIComponent(currentListHref)}`}` as Route;
                  const isArchiveCard = archiveMode === "archived";
                  const archiveSummary = getArchiveRequestSummary(request);
                  const accentClass = isArchiveCard ? "" : getCardAccentClass(request);
                  const itemWord = request.item_count === 1 ? "позиция" : request.item_count >= 2 && request.item_count <= 4 ? "позиции" : "позиций";

                  return (
                    <Link
                      key={request.id}
                      href={detailsHref}
                      className={`section-card purchase-request-card-link ${isArchiveCard ? "is-archived" : "is-live"} ${accentClass}`}
                    >
                      <div className="purchase-request-card">
                        <div className="purchase-request-card-head">
                          <div className="grid" style={{ gap: "0.3rem" }}>
                            <div className="purchase-request-card-title">
                              {resolveName(request.object)}
                              {request.request_kind === "draft" && request.draft_date
                                ? ` • черновик на ${formatRequestDate(request.draft_date)}`
                                : ""}
                            </div>
                            <div className="text-soft" style={{ fontSize: "0.88rem" }}>
                              {request.description?.trim() || (request.source === "warehouse_daily" ? "Из ежедневного дефицита склада" : "Ручная заявка")}
                              {" · "}{formatRequestDate(request.created_at)}
                            </div>
                            {request.assignee ? (
                              <div className="text-soft" style={{ fontSize: "0.85rem" }}>
                                Исполнитель: {resolveUser(request.assignee)}
                              </div>
                            ) : null}
                          </div>

                          <div className="purchase-request-card-badges">
                            {request.request_kind === "draft" ? (
                              <Badge tone="warning">Черновик</Badge>
                            ) : (
                              <Badge tone={statusMeta.tone}>{statusMeta.label}</Badge>
                            )}
                            {executorMeta ? <Badge tone="neutral">{executorMeta.label}</Badge> : null}
                          </div>
                        </div>

                        {request.preview_items.length ? (
                          <div className="purchase-request-card-preview">
                            <div className="purchase-request-card-preview-list">
                              {request.preview_items.map((item) => (
                                <span key={`${request.id}-${item}`} className="purchase-request-pill">
                                  {item}
                                </span>
                              ))}
                              {request.item_count > request.preview_items.length ? (
                                <span className="purchase-request-pill text-soft">
                                  +{request.item_count - request.preview_items.length} ещё
                                </span>
                              ) : null}
                            </div>
                          </div>
                        ) : null}

                        <div className="purchase-request-card-foot">
                          {isArchiveCard ? (
                            <div className="text-soft" style={{ fontSize: "0.85rem" }}>{archiveSummary}</div>
                          ) : (
                            <div className="text-soft" style={{ fontSize: "0.85rem" }}>
                              {request.item_count} {itemWord}
                            </div>
                          )}
                          <div className="purchase-request-card-foot-cta">
                            Открыть <ChevronRight size={14} aria-hidden="true" />
                          </div>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </PprPageShell>

      {canCreate ? (
        <PprModal
          open={isCreateOpen}
          onClose={() => {
            setIsCreateOpen(false);
            setIsDirty(false);
          }}
          title="Новая заявка на закупку"
          isDirty={isDirty}
        >
          <PurchaseRequestForm
            action={createPurchaseRequestAction}
            objects={createObjects}
            stockItems={stockItems}
            onSubmitted={() => {
              setIsCreateOpen(false);
              setIsDirty(false);
            }}
            onChange={() => setIsDirty(true)}
            submitLabel="Создать"
          />
        </PprModal>
      ) : null}
    </>
  );
}
