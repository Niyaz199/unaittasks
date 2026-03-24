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

export function RoundsTodayBoard({ objects, rows, initialObjectId = "", initialOperationalDate, initialQuery = "" }: Props) {
  const router = useRouter();
  const [filterObjectId, setFilterObjectId] = useState(initialObjectId);
  const [operationalDate, setOperationalDate] = useState(initialOperationalDate);
  const [searchTerm, setSearchTerm] = useState(initialQuery);
  const [activeFloor, setActiveFloor] = useState<string | null>(null);

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

  const filteredRows = useMemo(() => {
    if (!filterObjectId) return [];
    const query = searchTerm.trim().toLowerCase();
    return objectRows.filter((row) => {
      const matchesFloor = activeFloor && !query ? row.floor_name === activeFloor : true;
      const matchesQuery = query === "" || row.room_name.toLowerCase().includes(query);
      return matchesFloor && matchesQuery;
    });
  }, [objectRows, activeFloor, searchTerm, filterObjectId]);

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
                    <div className="row" style={{ flexWrap: "wrap" }}>
                      <Badge tone={row.has_comment ? "info" : "neutral"}>{row.has_comment ? "Есть комментарий" : "Без комментария"}</Badge>
                      <Badge tone={row.has_photo ? "info" : "neutral"}>{row.has_photo ? "Есть фото" : "Без фото"}</Badge>
                    </div>
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
                <div className="row" style={{ flexWrap: "wrap" }}>
                  <Badge tone={row.has_comment ? "info" : "neutral"}>{row.has_comment ? "Комментарий" : "Без комм."}</Badge>
                  <Badge tone={row.has_photo ? "info" : "neutral"}>{row.has_photo ? "Фото" : "Без фото"}</Badge>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
