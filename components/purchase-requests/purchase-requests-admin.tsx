"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState, useTransition } from "react";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { DataTable } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { PprModal } from "@/components/ppr/ui/ppr-modal";
import { PprPageShell } from "@/components/ppr/ui/ppr-page-shell";
import { useToast } from "@/components/ui/toast";
import { purchaseRequestStatusMeta } from "@/lib/purchase-requests/presentation";
import { createPurchaseRequestAction, updatePurchaseRequestStatusAction } from "@/app/actions/purchase-request-actions";

const PurchaseRequestForm = dynamic(
  () => import("@/components/purchase-requests/purchase-request-form").then((module) => module.PurchaseRequestForm),
  { loading: () => <div className="section-card text-soft">Загрузка...</div> }
);

type PurchaseRequestItemRow = {
  id: string;
  title: string;
  unit: string;
  quantity_requested: number;
  note: string | null;
  is_auto_generated: boolean;
};

type PurchaseRequestRow = {
  id: string;
  object_id: string;
  status: "new" | "in_progress" | "fulfilled" | "cancelled";
  source: "manual" | "low_stock";
  description: string | null;
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

function formatQty(value: number, unit: string) {
  return `${Number(value).toLocaleString("ru-RU", { maximumFractionDigits: 3 })} ${unit}`;
}

export function PurchaseRequestsAdmin({
  requests,
  objects,
  stockItems,
  canManage,
  initialFilterObjectId = "",
}: {
  requests: PurchaseRequestRow[];
  objects: ObjectOption[];
  stockItems: StockItemOption[];
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
      const matchesStatus = filterStatus === "all" || request.status === filterStatus;
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

  const metrics = useMemo(() => {
    const total = requests.length;
    const open = requests.filter((item) => item.status === "new" || item.status === "in_progress").length;
    const lowStock = requests.filter((item) => item.source === "low_stock" && item.status !== "fulfilled" && item.status !== "cancelled").length;
    const completed = requests.filter((item) => item.status === "fulfilled").length;
    return [
      { label: "Всего заявок", value: total, tone: "neutral" as const },
      { label: "Открытых", value: open, tone: "warning" as const },
      { label: "Авто из склада", value: lowStock, tone: "danger" as const },
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
          hint: "Они появятся здесь после ручного создания или при критическом остатке на складе.",
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

            <button className="btn btn-accent" type="button" onClick={() => setIsCreateOpen(true)}>
              + Заявка
            </button>
          </>
        }
      >
        <div className="desktop-only">
          <DataTable
            columns={[
              { key: "request", label: "Заявка" },
              { key: "object", label: "Объект" },
              { key: "requester", label: "Заявитель" },
              { key: "status", label: "Статус" },
              { key: "actions", label: "Действия" },
            ]}
          >
            {filteredRequests.map((request) => {
              const statusMeta = purchaseRequestStatusMeta[request.status];
              const itemsLabel = (request.items ?? [])
                .map((item) => `${item.title} (${formatQty(item.quantity_requested, item.unit)})`)
                .join(", ");
              return (
                <tr key={request.id}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{itemsLabel || "Без позиций"}</div>
                    <div className="text-soft">
                      {request.source === "low_stock" ? "Автоматически из склада" : "Ручная заявка"} • {new Date(request.created_at).toLocaleString("ru-RU")}
                    </div>
                    {request.description?.trim() ? <div className="text-soft">{request.description}</div> : null}
                  </td>
                  <td>{resolveName(request.object)}</td>
                  <td>
                    <div>{resolveUser(request.requester)}</div>
                    <div className="text-soft">Исполнитель: {resolveUser(request.assignee)}</div>
                  </td>
                  <td>
                    <Badge tone={statusMeta.tone}>{statusMeta.label}</Badge>
                  </td>
                  <td>
                    {canManage ? (
                      <div className="row" style={{ gap: "0.35rem", flexWrap: "wrap" }}>
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
                      </div>
                    ) : (
                      <span className="text-soft">Только просмотр</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </DataTable>
        </div>

        <div className="mobile-cards mobile-only">
          {filteredRequests.map((request) => {
            const statusMeta = purchaseRequestStatusMeta[request.status];
            return (
              <div key={request.id} className="section-card mobile-card">
                <div className="grid" style={{ gap: "0.55rem" }}>
                  <div style={{ fontWeight: 600 }}>
                    {(request.items ?? []).map((item) => item.title).join(", ") || "Без позиций"}
                  </div>
                  <div className="text-soft">Объект: {resolveName(request.object)}</div>
                  <div className="text-soft">Заявитель: {resolveUser(request.requester)}</div>
                  <div className="text-soft">Исполнитель: {resolveUser(request.assignee)}</div>
                  <div className="row" style={{ gap: "0.35rem", flexWrap: "wrap" }}>
                    <Badge tone={statusMeta.tone}>{statusMeta.label}</Badge>
                    {request.source === "low_stock" ? <Badge tone="danger">Из low-stock</Badge> : <Badge tone="info">Ручная</Badge>}
                  </div>
                  {canManage ? (
                    <div className="row" style={{ gap: "0.35rem", flexWrap: "wrap" }}>
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
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </PprPageShell>

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
    </>
  );
}
