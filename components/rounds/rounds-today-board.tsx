"use client";

import type { Route } from "next";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { RoundsObjectOption, RoundsTodayRow } from "@/lib/rounds/types";
import { DataTable } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";

type Props = {
  objects: RoundsObjectOption[];
  rows: RoundsTodayRow[];
  initialObjectId?: string;
  initialOperationalDate: string;
  initialQuery?: string;
};

type RoundsEvidenceCellProps = {
  row: RoundsTodayRow;
  expanded: boolean;
  variant?: "table" | "card";
  onToggleComment: () => void;
  onOpenPhoto: (url: string) => void;
};

function isExpandableComment(comment: string) {
  return comment.length > 120 || comment.includes("\n");
}

function RoundsEvidenceCell({
  row,
  expanded,
  variant = "table",
  onToggleComment,
  onOpenPhoto,
}: RoundsEvidenceCellProps) {
  const comment = row.comment?.trim() ?? "";
  const hasComment = comment.length > 0;
  const hasPhoto = Boolean(row.photo_url);
  const expandableComment = hasComment && isExpandableComment(comment);

  return (
    <div className={`rounds-evidence-cell${variant === "table" ? " rounds-evidence-cell--table" : ""}`}>
      {hasComment ? (
        <div className="rounds-evidence-section">
          <div
            className={`rounds-comment-text${!expanded ? " rounds-comment-text--clamped" : ""}`}
            title={!expanded && expandableComment ? comment : undefined}
          >
            {comment}
          </div>
          {expandableComment ? (
            <button type="button" className="rounds-inline-action" onClick={onToggleComment}>
              {expanded ? "Свернуть" : "Развернуть"}
            </button>
          ) : null}
        </div>
      ) : (
        <Badge tone="neutral">Без комментария</Badge>
      )}

      {hasPhoto && row.photo_url ? (
        <button type="button" className="rounds-photo-action" onClick={() => onOpenPhoto(row.photo_url!)}>
          Открыть фото
        </button>
      ) : (
        <Badge tone="neutral">Без фото</Badge>
      )}
    </div>
  );
}

export function RoundsTodayBoard({ objects, rows, initialObjectId = "", initialOperationalDate, initialQuery = "" }: Props) {
  const router = useRouter();
  const [filterObjectId, setFilterObjectId] = useState(initialObjectId);
  const [operationalDate, setOperationalDate] = useState(initialOperationalDate);
  const [searchTerm, setSearchTerm] = useState(initialQuery);
  const [activeFloor, setActiveFloor] = useState<string | null>(null);
  const [expandedComments, setExpandedComments] = useState<Record<string, boolean>>({});
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

  function updateSearchParams(nextObjectId: string, nextDate: string, nextQuery: string) {
    const params = new URLSearchParams();
    if (nextObjectId) params.set("objectId", nextObjectId);
    if (nextDate) params.set("operationalDate", nextDate);
    if (nextQuery.trim()) params.set("q", nextQuery.trim());
    router.replace((`/rounds/today${params.toString() ? `?${params.toString()}` : ""}`) as Route);
  }

  const objectRows = useMemo(() => {
    if (!filterObjectId) return [];
    return rows.filter((row) => row.object_id === filterObjectId);
  }, [filterObjectId, rows]);

  const floors = useMemo(() => {
    const uniqueFloors = new Set(objectRows.map((row) => row.floor_name));
    return Array.from(uniqueFloors);
  }, [objectRows]);

  useEffect(() => {
    if (floors.length > 0 && (!activeFloor || !floors.includes(activeFloor))) {
      setActiveFloor(floors[0]);
    } else if (floors.length === 0) {
      setActiveFloor(null);
    }
  }, [floors, activeFloor]);

  useEffect(() => {
    if (!lightboxSrc) return undefined;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setLightboxSrc(null);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [lightboxSrc]);

  const filteredRows = useMemo(() => {
    if (!filterObjectId) return [];
    const query = searchTerm.trim().toLowerCase();
    return objectRows.filter((row) => {
      const matchesFloor = activeFloor && !query ? row.floor_name === activeFloor : true;
      const matchesQuery = query === "" || row.room_name.toLowerCase().includes(query);
      return matchesFloor && matchesQuery;
    });
  }, [objectRows, activeFloor, searchTerm, filterObjectId]);

  function toggleComment(rowId: string) {
    setExpandedComments((current) => ({ ...current, [rowId]: !current[rowId] }));
  }

  return (
    <div className="grid">
      <div className="section-card filters-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
        <select
          className="select"
          value={filterObjectId}
          onChange={(event) => {
            const value = event.target.value;
            setFilterObjectId(value);
            updateSearchParams(value, operationalDate, searchTerm);
          }}
        >
          <option value="">Выберите объект...</option>
          {objects.map((objectItem) => (
            <option key={objectItem.id} value={objectItem.id}>
              {objectItem.name}
            </option>
          ))}
        </select>
        <input
          className="input"
          type="date"
          value={operationalDate}
          onChange={(event) => {
            const value = event.target.value;
            setOperationalDate(value);
            updateSearchParams(filterObjectId, value, searchTerm);
          }}
        />
        <input
          className="input"
          type="search"
          value={searchTerm}
          onChange={(event) => {
            const value = event.target.value;
            setSearchTerm(value);
            updateSearchParams(filterObjectId, operationalDate, value);
          }}
          placeholder="Поиск по помещению"
        />
      </div>

      {!filterObjectId ? (
        <div className="section-card text-soft">
          Выберите объект для просмотра списка помещений.
        </div>
      ) : (
        <>
          {floors.length > 0 && (
            <div className="row" style={{ flexWrap: "wrap", marginBottom: "1rem", gap: "0.5rem" }}>
              {floors.map((floor) => (
                <button
                  key={floor}
                  type="button"
                  className={`btn ${activeFloor === floor ? "btn-accent" : "btn-ghost"}`}
                  onClick={() => setActiveFloor(floor)}
                >
                  {floor}
                </button>
              ))}
            </div>
          )}

          <div className="desktop-only">
            <DataTable
              columns={[
                { key: "room", label: "Помещение" },
                { key: "status", label: "Статус" },
                { key: "user", label: "Кто отметил" },
                { key: "time", label: "Время" },
                { key: "flags", label: "Комментарий / фото" },
              ]}
            >
              {filteredRows.map((row) => (
                <tr key={row.room_id}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{row.room_name}</div>
                    {searchTerm.trim() && <div className="text-soft">{row.floor_name}</div>}
                  </td>
                  <td>{row.status === "checked_in" ? <Badge tone="success">Отмечено</Badge> : <Badge tone="warning">Не отмечено</Badge>}</td>
                  <td>{row.checked_in_by ?? "—"}</td>
                  <td>{row.checked_in_at ? new Date(row.checked_in_at).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" }) : "—"}</td>
                  <td>
                    <RoundsEvidenceCell
                      row={row}
                      expanded={Boolean(expandedComments[row.room_id])}
                      onToggleComment={() => toggleComment(row.room_id)}
                      onOpenPhoto={setLightboxSrc}
                    />
                  </td>
                </tr>
              ))}
            </DataTable>
          </div>

          <div className="mobile-cards mobile-only">
            {filteredRows.map((row) => (
              <div key={row.room_id} className="section-card mobile-card grid" style={{ gap: "0.45rem" }}>
                <div>
                  <div style={{ fontWeight: 700 }}>{row.room_name}</div>
                  {searchTerm.trim() && <div className="text-soft">{row.floor_name}</div>}
                </div>
                <div>{row.status === "checked_in" ? <Badge tone="success">Отмечено</Badge> : <Badge tone="warning">Не отмечено</Badge>}</div>
                <div className="text-soft">
                  {row.checked_in_by ? `${row.checked_in_by} • ${new Date(row.checked_in_at ?? "").toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}` : "Сегодня отметки нет"}
                </div>
                <RoundsEvidenceCell
                  row={row}
                  variant="card"
                  expanded={Boolean(expandedComments[row.room_id])}
                  onToggleComment={() => toggleComment(row.room_id)}
                  onOpenPhoto={setLightboxSrc}
                />
              </div>
            ))}
          </div>

          {lightboxSrc ? (
            <div
              className="att-lightbox"
              role="dialog"
              aria-modal="true"
              aria-label="Просмотр фото обхода"
              onClick={() => setLightboxSrc(null)}
            >
              <button
                type="button"
                className="att-lightbox-close"
                onClick={() => setLightboxSrc(null)}
                aria-label="Закрыть"
              >
                ✕
              </button>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={lightboxSrc}
                alt="Фото обхода"
                className="att-lightbox-img"
                onClick={(event) => event.stopPropagation()}
              />
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
