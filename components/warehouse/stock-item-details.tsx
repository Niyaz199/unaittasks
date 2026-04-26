"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { StockItemForm } from "@/components/warehouse/stock-item-form";
import { PprModal } from "@/components/ppr/ui/ppr-modal";
import { updateStockItemAction } from "@/app/actions/warehouse-actions";
import { stockItemKindMeta, procurementMethodMeta, stockMovementTypeMeta } from "@/lib/warehouse/presentation";
import { STOCK_ITEM_ALLOWED_MIME_TYPES, STOCK_ITEM_MAX_FILE_SIZE_BYTES, STOCK_ITEM_MAX_FILES_PER_UPLOAD } from "@/lib/warehouse/stock-item-files";
import type { StockItemDetails, StockItemAttachmentWithUrl } from "@/lib/warehouse/queries";

type TabKey = "info" | "docs" | "movements" | "usage";

type ObjectOption = { id: string; name: string };
type LocationOption = { id: string; object_id: string; name: string; is_active?: boolean };
type SystemGroupOption = { id: string; name: string; code: string; is_active?: boolean };
type PprTemplateOption = {
  id: string;
  name: string;
  object_id: string;
  system_id: string;
  system_group_id: string;
};

function unwrap<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : (value ?? null);
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "—";
  return parsed.toLocaleDateString("ru-RU");
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "—";
  return parsed.toLocaleString("ru-RU");
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} КБ`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
}

function PdfIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <path d="M9 13h1.5a1.5 1.5 0 0 1 0 3H9v-3zM14 13h2M14 13v3M17 13v3" />
    </svg>
  );
}

function ImageIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <polyline points="21 15 16 10 5 21" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6M14 11v6" />
      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    </svg>
  );
}

export function StockItemDetailsView({
  details,
  canManage,
  objects = [],
  locations = [],
  systemGroups = [],
  pprTemplates = [],
}: {
  details: StockItemDetails;
  canManage: boolean;
  objects?: ObjectOption[];
  locations?: LocationOption[];
  systemGroups?: SystemGroupOption[];
  pprTemplates?: PprTemplateOption[];
}) {
  const router = useRouter();
  const { item, balances, movements, usage, attachments } = details;
  const [activeTab, setActiveTab] = useState<TabKey>("info");
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isEditDirty, setIsEditDirty] = useState(false);

  const isLowStock = item.current_qty < item.min_qty;
  const objectName = unwrap(item.object)?.name ?? "—";
  const storageLocation = unwrap(item.storage_location);
  const totalOnBalance = useMemo(
    () => balances.reduce((sum, row) => sum + Number(row.qty ?? 0), 0),
    [balances]
  );
  const criticalUsage = usage.filter((row) => row.is_critical).length;

  return (
    <section className="grid" style={{ gap: "0.75rem" }}>
      {/* HERO — компактно */}
      <div className="section-card" style={{ padding: "1rem 1.25rem" }}>
        <div className="grid" style={{ gap: "0.75rem" }}>
          <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start", gap: "0.75rem", flexWrap: "wrap" }}>
            <div style={{ minWidth: 0 }}>
              <div className="text-soft" style={{ fontSize: "0.8rem", marginBottom: "0.3rem", letterSpacing: "0.04em" }}>
                {objectName}
              </div>
              <div className="row" style={{ gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
                <h2 style={{ margin: 0, fontSize: "1.4rem", lineHeight: 1.25 }}>{item.name}</h2>
                {item.sku ? (
                  <Badge tone="neutral" style={{ fontFamily: "monospace", fontSize: "0.8rem" }}>
                    Арт. {item.sku}
                  </Badge>
                ) : null}
              </div>
              {item.manufacturer || item.model ? (
                <div className="text-soft" style={{ fontSize: "0.85rem", marginTop: "0.25rem" }}>
                  {[item.manufacturer, item.model].filter(Boolean).join(" • ")}
                </div>
              ) : null}
            </div>
            <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap", alignItems: "center" }}>
              <Badge tone="violet">{stockItemKindMeta[item.kind].label}</Badge>
              {item.is_spare_part ? <Badge tone="info">ЗИП</Badge> : null}
              {!item.is_active ? <Badge tone="neutral">Неактивна</Badge> : null}
              {isLowStock ? <Badge tone="danger">Ниже минимума</Badge> : null}
              {canManage ? (
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setIsEditOpen(true)}
                  style={{ padding: "0.4rem 0.75rem", minHeight: "36px", fontSize: "0.88rem" }}
                >
                  Редактировать
                </button>
              ) : null}
            </div>
          </div>

          <div className="td-meta-grid" style={{ borderTop: "1px solid color-mix(in srgb, var(--line) 40%, transparent)", paddingTop: "0.75rem" }}>
            <div className="td-meta-item">
              <span className="td-meta-label">На балансе</span>
              <span className="td-meta-value" style={{ fontWeight: 600, color: isLowStock ? "var(--danger)" : undefined }}>
                {item.current_qty} {item.unit}
              </span>
            </div>
            <div className="td-meta-item">
              <span className="td-meta-label">Минимум</span>
              <span className="td-meta-value">{item.min_qty} {item.unit}</span>
            </div>
            <div className="td-meta-item">
              <span className="td-meta-label">Место хранения</span>
              <span className="td-meta-value">{storageLocation?.name ?? "—"}</span>
            </div>
            <div className="td-meta-item">
              <span className="td-meta-label">Закупка</span>
              <span className="td-meta-value">{procurementMethodMeta[item.procurement_method].label}</span>
            </div>
          </div>
        </div>
      </div>

      {/* TABS */}
      <div>
        <div className="warehouse-view-switch" role="tablist" aria-label="Разделы карточки ТМЦ">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "info"}
            className={`warehouse-view-tab ${activeTab === "info" ? "is-active" : ""}`}
            onClick={() => setActiveTab("info")}
            style={{ cursor: "pointer", minHeight: "44px" }}
          >
            Характеристики
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "docs"}
            className={`warehouse-view-tab ${activeTab === "docs" ? "is-active" : ""}`}
            onClick={() => setActiveTab("docs")}
            style={{ cursor: "pointer", minHeight: "44px" }}
          >
            Документы
            {attachments.length ? <span className="warehouse-view-tab-count">{attachments.length}</span> : null}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "movements"}
            className={`warehouse-view-tab ${activeTab === "movements" ? "is-active" : ""}`}
            onClick={() => setActiveTab("movements")}
            style={{ cursor: "pointer", minHeight: "44px" }}
          >
            Движение
            {movements.length ? <span className="warehouse-view-tab-count">{movements.length}</span> : null}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "usage"}
            className={`warehouse-view-tab ${activeTab === "usage" ? "is-active" : ""}`}
            onClick={() => setActiveTab("usage")}
            style={{ cursor: "pointer", minHeight: "44px" }}
          >
            Используется в
            {usage.length ? (
              <span
                className="warehouse-view-tab-count"
                style={criticalUsage ? { background: "var(--danger)", color: "#fff" } : undefined}
                title={criticalUsage ? `${criticalUsage} критично` : undefined}
              >
                {usage.length}
              </span>
            ) : null}
          </button>
        </div>

        <div className="section-card" style={{ padding: "1.25rem" }}>
          {activeTab === "info" ? (
            <InfoTab item={item} balances={balances} totalOnBalance={totalOnBalance} />
          ) : null}
          {activeTab === "docs" ? (
            <DocsTab
              stockItemId={item.id}
              attachments={attachments}
              canManage={canManage}
            />
          ) : null}
          {activeTab === "movements" ? <MovementsTab movements={movements} /> : null}
          {activeTab === "usage" ? <UsageTab usage={usage} /> : null}
        </div>
      </div>

      {/* FOOT — meta */}
      <div className="text-soft" style={{ fontSize: "0.78rem", padding: "0.5rem 0.25rem" }}>
        Создана: {formatDateTime(item.created_at)}
      </div>

      {canManage && isEditOpen ? (
        <PprModal
          open={isEditOpen}
          onClose={() => {
            setIsEditOpen(false);
            setIsEditDirty(false);
          }}
          title="Редактирование ТМЦ"
          isDirty={isEditDirty}
        >
          <StockItemForm
            key={`edit-${item.id}`}
            action={updateStockItemAction}
            itemId={item.id}
            objects={objects}
            locations={locations}
            systemGroups={systemGroups}
            pprTemplates={pprTemplates}
            fixedObjectId={item.object_id}
            fixedObjectName={objectName}
            initialValues={{
              object_id: item.object_id,
              name: item.name,
              kind: item.kind,
              is_spare_part: item.is_spare_part,
              procurement_method: item.procurement_method,
              unit: item.unit,
              sku: item.sku ?? "",
              manufacturer: item.manufacturer ?? "",
              model: item.model ?? "",
              description: item.description ?? "",
              min_qty: String(item.min_qty),
              storage_location_id: item.storage_location_id ?? "",
              system_group_ids: (item.system_group_links ?? []).map((link) => link.system_group_id),
              ppr_template_links: (item.ppr_template_links ?? []).map((link) => ({
                template_id: link.template_id,
                required_qty: String(link.required_qty),
              })),
              comment: item.comment ?? "",
              is_active: item.is_active,
            }}
            onSubmitted={() => {
              setIsEditOpen(false);
              setIsEditDirty(false);
              router.refresh();
            }}
            onChange={() => setIsEditDirty(true)}
            submitLabel="Сохранить"
          />
        </PprModal>
      ) : null}
    </section>
  );
}

function InfoTab({
  item,
  balances,
  totalOnBalance,
}: {
  item: StockItemDetails["item"];
  balances: StockItemDetails["balances"];
  totalOnBalance: number;
}) {
  const description = item.description ?? item.comment ?? null;
  return (
    <div className="grid" style={{ gap: "1.25rem" }}>
      {description ? (
        <div className="grid" style={{ gap: "0.3rem" }}>
          <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 600 }}>Описание</h3>
          <p style={{ margin: 0, lineHeight: 1.55, whiteSpace: "pre-wrap" }}>{description}</p>
        </div>
      ) : (
        <div className="text-soft" style={{ fontSize: "0.9rem" }}>Описание не заполнено.</div>
      )}

      <div className="grid" style={{ gap: "0.4rem" }}>
        <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 600 }}>Реквизиты</h3>
        <div className="td-meta-grid">
          <MetaRow label="Производитель" value={item.manufacturer} />
          <MetaRow label="Модель" value={item.model} />
          <MetaRow label="Артикул / SKU" value={item.sku} mono />
          <MetaRow label="Единица измерения" value={item.unit} />
        </div>
      </div>

      {balances.length ? (
        <div className="grid" style={{ gap: "0.4rem" }}>
          <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 600 }}>
            Остатки по местам хранения
            <span className="text-soft" style={{ fontWeight: 400, fontSize: "0.85rem", marginLeft: "0.5rem" }}>
              всего {totalOnBalance} {item.unit}
            </span>
          </h3>
          <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: "0.35rem" }}>
            {balances.map((balance) => {
              const balanceItem = unwrap(balance.item);
              const balanceLocation = unwrap(balance.location);
              return (
                <li
                  key={balance.id}
                  className="row"
                  style={{
                    justifyContent: "space-between",
                    padding: "0.5rem 0.75rem",
                    background: "color-mix(in srgb, var(--panel-soft) 40%, transparent)",
                    borderRadius: "6px",
                    fontSize: "0.92rem",
                  }}
                >
                  <span>{balanceLocation?.name ?? "Без места хранения"}</span>
                  <strong>{balance.qty} {balanceItem?.unit ?? item.unit}</strong>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function MetaRow({ label, value, mono }: { label: string; value: string | null | undefined; mono?: boolean }) {
  return (
    <div className="td-meta-item">
      <span className="td-meta-label">{label}</span>
      <span className="td-meta-value" style={mono ? { fontFamily: "monospace" } : undefined}>
        {value && value.trim() ? value : "—"}
      </span>
    </div>
  );
}

function DocsTab({
  stockItemId,
  attachments,
  canManage,
}: {
  stockItemId: string;
  attachments: StockItemAttachmentWithUrl[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleFiles(event: React.ChangeEvent<HTMLInputElement>) {
    const inputEl = event.target;
    const files = Array.from(inputEl.files ?? []);
    if (!files.length) return;

    if (files.length > STOCK_ITEM_MAX_FILES_PER_UPLOAD) {
      setError(`Максимум ${STOCK_ITEM_MAX_FILES_PER_UPLOAD} файлов за раз`);
      inputEl.value = "";
      return;
    }
    const oversize = files.find((f) => f.size > STOCK_ITEM_MAX_FILE_SIZE_BYTES);
    if (oversize) {
      setError(`Файл «${oversize.name}» превышает 10 МБ`);
      inputEl.value = "";
      return;
    }
    const badType = files.find((f) => !(STOCK_ITEM_ALLOWED_MIME_TYPES as readonly string[]).includes(f.type));
    if (badType) {
      setError(`Неподдерживаемый тип файла «${badType.name}»`);
      inputEl.value = "";
      return;
    }

    startTransition(async () => {
      try {
        setError(null);
        const formData = new FormData();
        for (const file of files) formData.append("files", file);
        const response = await fetch(`/api/warehouse/items/${stockItemId}/attachments`, {
          method: "POST",
          body: formData,
        });
        const result = await response.json().catch(() => ({} as { error?: string }));
        if (!response.ok) throw new Error(result.error ?? "Не удалось загрузить файлы");
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Ошибка загрузки");
      } finally {
        inputEl.value = "";
      }
    });
  }

  function handleDelete(attachmentId: string) {
    if (!window.confirm("Удалить вложение?")) return;
    startTransition(async () => {
      try {
        setError(null);
        const response = await fetch(
          `/api/warehouse/items/${stockItemId}/attachments?attachment_id=${attachmentId}`,
          { method: "DELETE" }
        );
        const result = await response.json().catch(() => ({} as { error?: string }));
        if (!response.ok) throw new Error(result.error ?? "Не удалось удалить вложение");
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Ошибка удаления");
      }
    });
  }

  return (
    <div className="grid" style={{ gap: "1rem" }}>
      <div className="grid" style={{ gap: "0.3rem" }}>
        <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 600 }}>Документы</h3>
        <p className="text-soft" style={{ margin: 0, fontSize: "0.85rem" }}>
          PDF-паспорта, инструкции, фото. До 10 МБ на файл.
        </p>
      </div>

      {canManage ? (
        <label
          className="btn btn-accent"
          style={{
            cursor: pending ? "wait" : "pointer",
            opacity: pending ? 0.6 : 1,
            width: "fit-content",
            minHeight: "44px",
            padding: "0.6rem 1.1rem",
          }}
        >
          {pending ? "Загрузка..." : "Загрузить файлы"}
          <input
            type="file"
            multiple
            accept={STOCK_ITEM_ALLOWED_MIME_TYPES.join(",")}
            onChange={handleFiles}
            disabled={pending}
            style={{ display: "none" }}
          />
        </label>
      ) : null}

      {error ? (
        <div
          role="alert"
          style={{
            padding: "0.55rem 0.85rem",
            borderRadius: "6px",
            background: "color-mix(in srgb, var(--danger) 12%, transparent)",
            border: "1px solid color-mix(in srgb, var(--danger) 30%, transparent)",
            color: "var(--danger)",
            fontSize: "0.88rem",
          }}
        >
          {error}
        </div>
      ) : null}

      {attachments.length ? (
        <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: "0.5rem" }}>
          {attachments.map((att) => {
            const isPdf = att.mime_type === "application/pdf";
            return (
              <li
                key={att.id}
                className="row"
                style={{
                  gap: "0.75rem",
                  padding: "0.65rem 0.85rem",
                  background: "color-mix(in srgb, var(--panel-soft) 40%, transparent)",
                  border: "1px solid color-mix(in srgb, var(--line) 40%, transparent)",
                  borderRadius: "8px",
                  alignItems: "center",
                  transition: "background 150ms ease",
                }}
              >
                <span style={{ color: "var(--text-soft)", flexShrink: 0 }} aria-hidden="true">
                  {isPdf ? <PdfIcon /> : <ImageIcon />}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  {att.url ? (
                    <a
                      href={att.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ fontWeight: 500, textDecoration: "none", color: "inherit" }}
                    >
                      {att.file_name}
                    </a>
                  ) : (
                    <span style={{ fontWeight: 500 }}>{att.file_name}</span>
                  )}
                  <div className="text-soft" style={{ fontSize: "0.78rem" }}>
                    {formatSize(att.size_bytes)} • {formatDate(att.created_at)}
                  </div>
                </div>
                {canManage ? (
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => handleDelete(att.id)}
                    disabled={pending}
                    aria-label={`Удалить ${att.file_name}`}
                    style={{
                      padding: "0.4rem 0.6rem",
                      minHeight: "36px",
                      color: "var(--danger)",
                      cursor: pending ? "wait" : "pointer",
                    }}
                  >
                    <TrashIcon />
                  </button>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : (
        <div
          className="text-soft"
          style={{
            padding: "1.25rem",
            textAlign: "center",
            border: "1px dashed color-mix(in srgb, var(--line-strong) 60%, transparent)",
            borderRadius: "8px",
            fontSize: "0.9rem",
          }}
        >
          Файлов пока нет.{canManage ? " Прикрепите PDF-паспорт или фото." : ""}
        </div>
      )}
    </div>
  );
}

function MovementsTab({ movements }: { movements: StockItemDetails["movements"] }) {
  if (!movements.length) {
    return <div className="text-soft" style={{ padding: "1rem 0" }}>Движений по этой ТМЦ пока нет.</div>;
  }
  return (
    <div className="grid" style={{ gap: "0.5rem" }}>
      <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 600 }}>Последние операции</h3>
      <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: "0.4rem" }}>
        {movements.map((movement) => {
          const actor = unwrap(movement.actor);
          const mvItem = unwrap(movement.item);
          const meta = stockMovementTypeMeta[movement.movement_type];
          const signed = movement.movement_type === "issue" || movement.movement_type === "adjustment_out" ? -Number(movement.quantity) : Number(movement.quantity);
          return (
            <li
              key={movement.id}
              className="row"
              style={{
                justifyContent: "space-between",
                alignItems: "flex-start",
                gap: "0.75rem",
                padding: "0.6rem 0.85rem",
                background: "color-mix(in srgb, var(--panel-soft) 40%, transparent)",
                borderRadius: "8px",
                flexWrap: "wrap",
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div className="row" style={{ gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
                  <Badge tone={meta.tone}>{meta.label}</Badge>
                  <span style={{ fontWeight: 600 }}>
                    {signed > 0 ? "+" : ""}{signed} {mvItem?.unit ?? ""}
                  </span>
                </div>
                {movement.note ? (
                  <div className="text-soft" style={{ fontSize: "0.85rem", marginTop: "0.25rem" }}>{movement.note}</div>
                ) : null}
              </div>
              <div className="text-soft" style={{ fontSize: "0.8rem", textAlign: "right" }}>
                <div>{formatDateTime(movement.created_at)}</div>
                <div>{actor?.full_name ?? "—"}</div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function UsageTab({ usage }: { usage: StockItemDetails["usage"] }) {
  if (!usage.length) {
    return <div className="text-soft" style={{ padding: "1rem 0" }}>Эта ТМЦ пока не привязана к оборудованию.</div>;
  }
  return (
    <div className="grid" style={{ gap: "0.5rem" }}>
      <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 600 }}>Используется в оборудовании</h3>
      <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: "0.45rem" }}>
        {usage.map((row) => (
          <li
            key={row.equipment_id}
            style={{
              padding: "0.65rem 0.85rem",
              background: "color-mix(in srgb, var(--panel-soft) 40%, transparent)",
              border: row.is_critical
                ? "1px solid color-mix(in srgb, var(--danger) 35%, transparent)"
                : "1px solid color-mix(in srgb, var(--line) 40%, transparent)",
              borderRadius: "8px",
            }}
          >
            <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start", gap: "0.5rem", flexWrap: "wrap" }}>
              <div style={{ minWidth: 0 }}>
                <Link
                  href={`/ppr/equipment/${row.equipment_id}`}
                  style={{ fontWeight: 600, textDecoration: "none", color: "inherit" }}
                >
                  {row.equipment_name}
                </Link>
                <div className="text-soft" style={{ fontSize: "0.82rem", marginTop: "0.2rem" }}>
                  {[row.object_name, row.system_name, row.inventory_no ? `Инв. ${row.inventory_no}` : null]
                    .filter(Boolean)
                    .join(" • ")}
                </div>
              </div>
              <div className="row" style={{ gap: "0.4rem", flexWrap: "wrap" }}>
                {row.is_critical ? <Badge tone="danger">Критично</Badge> : null}
                <Badge tone="neutral">{row.quantity} шт</Badge>
                {row.reserve_qty > 0 ? <Badge tone="info">Резерв: {row.reserve_qty}</Badge> : null}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
