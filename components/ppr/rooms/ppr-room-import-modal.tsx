"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { DataTable } from "@/components/ui/data-table";
import { DirectorySummary } from "@/components/ppr/ui/directory-summary";
import { PprModal } from "@/components/ppr/ui/ppr-modal";
import {
  formatObjectRoomImportStatusWhitelist,
  OBJECT_ROOM_IMPORT_MAX_FILE_SIZE_BYTES,
  OBJECT_ROOM_IMPORT_MAX_ROWS,
  validateObjectRoomImportSelectedFile,
  type ObjectRoomImportCommitResponse,
  type ObjectRoomImportPreviewResponse,
  type ObjectRoomImportPreviewRow,
} from "@/lib/object-room-import";

type Props = {
  open: boolean;
  onClose: () => void;
};

function getOutcomeLabel(row: ObjectRoomImportPreviewRow) {
  if (row.outcome === "ready") return "Готово";
  if (row.reason === "duplicate_in_db") return "Пропуск: дубль в БД";
  if (row.reason === "duplicate_in_file") return "Пропуск: дубль в файле";
  return "Ошибка";
}

function getOutcomeTone(row: ObjectRoomImportPreviewRow) {
  if (row.outcome === "ready") return "var(--success)";
  if (row.outcome === "skip") return "var(--warning)";
  return "var(--danger)";
}

export function PprRoomImportModal({ open, onClose }: Props) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<ObjectRoomImportPreviewResponse | null>(null);
  const [result, setResult] = useState<ObjectRoomImportCommitResponse | null>(null);
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [isCommitLoading, setIsCommitLoading] = useState(false);

  const isDirty = Boolean(fileName || preview) && !result;

  function resetState() {
    setPreview(null);
    setResult(null);
    setFileName("");
    setError(null);
    setIsPreviewLoading(false);
    setIsCommitLoading(false);
    if (inputRef.current) inputRef.current.value = "";
  }

  function handleClose() {
    resetState();
    onClose();
  }

  async function handlePreview(file: File) {
    const validationError = validateObjectRoomImportSelectedFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }

    setError(null);
    setFileName(file.name);
    setResult(null);
    setIsPreviewLoading(true);

    try {
      const formData = new FormData();
      formData.set("file", file);

      const response = await fetch("/api/ppr/rooms/import/preview", {
        method: "POST",
        body: formData,
      });

      const payload = (await response.json().catch(() => ({}))) as ObjectRoomImportPreviewResponse & { error?: string };
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error ?? "Не удалось подготовить предпросмотр импорта.");
      }

      setPreview(payload);
    } catch (previewError) {
      setPreview(null);
      setError(previewError instanceof Error ? previewError.message : "Не удалось подготовить предпросмотр импорта.");
    } finally {
      setIsPreviewLoading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function handleCommit() {
    if (!preview || preview.summary.readyCount === 0) return;

    setError(null);
    setIsCommitLoading(true);

    try {
      const response = await fetch("/api/ppr/rooms/import/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: preview.commitRows }),
      });

      const payload = (await response.json().catch(() => ({}))) as ObjectRoomImportCommitResponse & { error?: string };
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error ?? "Не удалось выполнить импорт.");
      }

      setResult(payload);
      if (payload.summary.created > 0) {
        router.refresh();
      }
    } catch (commitError) {
      setError(commitError instanceof Error ? commitError.message : "Не удалось выполнить импорт.");
    } finally {
      setIsCommitLoading(false);
    }
  }

  const previewMetrics = preview
    ? [
        { label: "Всего строк", value: preview.summary.totalRows, tone: "neutral" as const },
        { label: "Готово к импорту", value: preview.summary.readyCount, tone: "success" as const },
        { label: "Будут пропущены", value: preview.summary.skippedCount, tone: "warning" as const },
        { label: "Ошибок", value: preview.summary.errorCount, tone: "danger" as const },
      ]
    : [];

  const resultMetrics = result
    ? [
        { label: "Создано", value: result.summary.created, tone: "success" as const },
        { label: "Пропущено", value: result.summary.skipped, tone: "warning" as const },
        { label: "Ошибок", value: result.summary.errors, tone: "danger" as const },
      ]
    : [];

  return (
    <PprModal open={open} onClose={handleClose} title="Импорт помещений" isDirty={isDirty}>
      <div className="ppr-modal-content">
        <div className="ppr-modal-body grid">
          <div className="section-card" style={{ display: "grid", gap: "0.75rem" }}>
            <div style={{ fontWeight: 600 }}>Импорт новых помещений из файла</div>
            <div className="text-soft" style={{ fontSize: "0.9rem" }}>
              Поддерживаются форматы `.csv` и `.xlsx`. Обязательные колонки: `object`, `floor`, `name`, `type`, `status`, `description`.
            </div>
            <div className="text-soft" style={{ fontSize: "0.9rem" }}>
              Допустимые значения `status`: {formatObjectRoomImportStatusWhitelist()}. Максимум {OBJECT_ROOM_IMPORT_MAX_ROWS} строк и до{" "}
              {Math.floor(OBJECT_ROOM_IMPORT_MAX_FILE_SIZE_BYTES / 1024 / 1024)} MB за импорт.
            </div>
            <div className="row" style={{ gap: "0.5rem", flexWrap: "wrap" }}>
              <button
                className="btn btn-accent"
                type="button"
                disabled={isPreviewLoading || isCommitLoading}
                onClick={() => inputRef.current?.click()}
              >
                {isPreviewLoading ? "Загружаем..." : preview ? "Выбрать другой файл" : "Выбрать файл"}
              </button>
              <a className="btn btn-ghost" href="/templates/object-rooms-import-template.xlsx" download>
                Скачать шаблон
              </a>
            </div>
            <input
              ref={inputRef}
              type="file"
              accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="photo-picker-input-hidden"
              disabled={isPreviewLoading || isCommitLoading}
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) {
                  void handlePreview(file);
                }
              }}
            />
            {fileName ? <div className="text-soft">Текущий файл: {fileName}</div> : null}
          </div>

          {error ? (
            <div className="section-card" role="alert" style={{ borderColor: "var(--danger)", color: "var(--danger)" }}>
              {error}
            </div>
          ) : null}

          {preview ? <DirectorySummary metrics={previewMetrics} /> : null}

          {preview ? (
            <DataTable
              columns={[
                { key: "row", label: "Строка" },
                { key: "object", label: "Объект" },
                { key: "floor", label: "Этаж" },
                { key: "name", label: "Помещение" },
                { key: "type", label: "Тип" },
                { key: "status", label: "Status" },
                { key: "result", label: "Результат" },
                { key: "messages", label: "Сообщения" },
              ]}
            >
              {preview.rows.map((row) => (
                <tr key={row.rowNumber}>
                  <td>{row.rowNumber}</td>
                  <td>{row.object || "—"}</td>
                  <td>{row.floor || "—"}</td>
                  <td>{row.name || "—"}</td>
                  <td>{row.type || "—"}</td>
                  <td>{row.status || "—"}</td>
                  <td>
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        padding: "0.15rem 0.5rem",
                        borderRadius: "999px",
                        fontSize: "0.8rem",
                        fontWeight: 600,
                        color: getOutcomeTone(row),
                        border: `1px solid ${getOutcomeTone(row)}`,
                      }}
                    >
                      {getOutcomeLabel(row)}
                    </span>
                  </td>
                  <td>
                    {row.messages.length ? (
                      <div className="grid" style={{ gap: "0.25rem" }}>
                        {row.messages.map((message, index) => (
                          <div key={`${row.rowNumber}-${index}`} className="text-soft" style={{ fontSize: "0.85rem" }}>
                            {message}
                          </div>
                        ))}
                      </div>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))}
            </DataTable>
          ) : null}

          {result ? (
            <div className="grid" style={{ gap: "1rem" }}>
              <DirectorySummary metrics={resultMetrics} />
              {result.errors.length ? (
                <div className="section-card" style={{ display: "grid", gap: "0.5rem" }}>
                  <div style={{ fontWeight: 600 }}>Ошибки импорта</div>
                  <div className="grid" style={{ gap: "0.35rem" }}>
                    {result.errors.slice(0, 10).map((item, index) => (
                      <div key={`${item.rowNumber}-${index}`} className="text-soft">
                        Строка {item.rowNumber}: {item.message}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="ppr-modal-footer">
          <button
            className="btn btn-accent"
            type="button"
            disabled={!preview || preview.summary.readyCount === 0 || isPreviewLoading || isCommitLoading}
            onClick={() => void handleCommit()}
          >
            {isCommitLoading ? "Импортируем..." : "Импортировать"}
          </button>
        </div>
      </div>
    </PprModal>
  );
}
