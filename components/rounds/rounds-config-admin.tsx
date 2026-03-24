"use client";

import Link from "next/link";
import type { Route } from "next";
import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { RoundsConfigRoom, RoundsObjectOption } from "@/lib/rounds/types";
import { DataTable } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";

type Props = {
  objects: RoundsObjectOption[];
  rooms: RoundsConfigRoom[];
  initialObjectId?: string;
  initialQuery?: string;
};

type SaveConfigResponse = {
  ok?: boolean;
  partial?: boolean;
  message?: string;
  error?: string;
  result?: {
    requestedObjectIds?: string[];
    saved?: Array<{ objectId: string; enabledCount: number }>;
    failed?: Array<{ objectId: string; error: string }>;
  };
};

export function RoundsConfigAdmin({ objects, rooms, initialObjectId = "", initialQuery = "" }: Props) {
  const router = useRouter();
  const [filterObjectId, setFilterObjectId] = useState(initialObjectId);
  const [searchTerm, setSearchTerm] = useState(initialQuery);
  const [activeFloor, setActiveFloor] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [enabledIds, setEnabledIds] = useState(() => new Set(rooms.filter((room) => room.rounds_enabled).map((room) => room.id)));

  useEffect(() => {
    setEnabledIds(new Set(rooms.filter((room) => room.rounds_enabled).map((room) => room.id)));
  }, [rooms]);

  const objectRooms = useMemo(() => {
    if (!filterObjectId) return [];
    return rooms.filter((room) => room.object_id === filterObjectId);
  }, [filterObjectId, rooms]);

  const floors = useMemo(() => {
    const uniqueFloors = new Set(objectRooms.map((room) => room.floor_name));
    return Array.from(uniqueFloors);
  }, [objectRooms]);

  useEffect(() => {
    if (floors.length > 0 && (!activeFloor || !floors.includes(activeFloor))) {
      setActiveFloor(floors[0]);
    } else if (floors.length === 0) {
      setActiveFloor(null);
    }
  }, [floors, activeFloor]);

  const filteredRooms = useMemo(() => {
    if (!filterObjectId) return [];
    const query = searchTerm.trim().toLowerCase();
    return objectRooms.filter((room) => {
      const matchesFloor = activeFloor && !query ? room.floor_name === activeFloor : true;
      const matchesQuery = query === "" || room.room_name.toLowerCase().includes(query);
      return matchesFloor && matchesQuery;
    });
  }, [objectRooms, activeFloor, searchTerm, filterObjectId]);

  function updateSearchParams(nextObjectId: string, nextQuery: string) {
    const params = new URLSearchParams();
    if (nextObjectId) params.set("objectId", nextObjectId);
    if (nextQuery.trim()) params.set("q", nextQuery.trim());
    router.replace((`/rounds/config${params.toString() ? `?${params.toString()}` : ""}`) as Route);
  }

  function toggleRoom(roomId: string) {
    setEnabledIds((prev) => {
      const next = new Set(prev);
      if (next.has(roomId)) next.delete(roomId);
      else next.add(roomId);
      return next;
    });
  }

  function toggleVisible(value: boolean) {
    setEnabledIds((prev) => {
      const next = new Set(prev);
      for (const room of filteredRooms) {
        if (value) next.add(room.id);
        else next.delete(room.id);
      }
      return next;
    });
  }

  async function handleSave() {
    const targetObjectIds = filterObjectId
      ? [filterObjectId]
      : [...new Set(rooms.map((room) => room.object_id))];
    if (!targetObjectIds.length) {
      setMessage("Выберите объект для сохранения конфигурации.");
      return;
    }

    const operations = targetObjectIds.map((objectId) => ({
      objectId,
      enabledRoomIds: rooms
        .filter((room) => room.object_id === objectId && enabledIds.has(room.id))
        .map((room) => room.id),
    }));

    startTransition(async () => {
      setMessage(null);
      const response = await fetch("/api/rounds/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(filterObjectId ? operations[0] : { operations }),
      });
      const payload = (await response.json().catch(() => ({}))) as SaveConfigResponse;
      if (response.status === 207 || payload.partial) {
        const failedSummary = payload.result?.failed?.map((item) => `${item.objectId}: ${item.error}`).join(" | ");
        setMessage(
          failedSummary
            ? `${payload.message ?? "Конфигурация сохранена частично."} ${failedSummary}`
            : payload.message ?? "Конфигурация сохранена частично."
        );
        router.refresh();
        return;
      }
      if (!response.ok) {
        const failedSummary = payload.result?.failed?.map((item) => `${item.objectId}: ${item.error}`).join(" | ");
        setMessage(
          failedSummary
            ? `${payload.error ?? "Не удалось сохранить конфигурацию обходов."} ${failedSummary}`
            : payload.error ?? "Не удалось сохранить конфигурацию обходов."
        );
        return;
      }
      const savedCount = payload.result?.saved?.length ?? operations.length;
      setMessage(savedCount > 1 ? `Конфигурация сохранена для объектов: ${savedCount}.` : "Конфигурация сохранена.");
      router.refresh();
    });
  }

  return (
    <div className="grid">
      <div className="section-card grid" style={{ gap: "0.75rem" }}>
        <div className="filters-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
          <select
            className="select"
            value={filterObjectId}
            onChange={(event) => {
              const value = event.target.value;
              setFilterObjectId(value);
              updateSearchParams(value, searchTerm);
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
            value={searchTerm}
            onChange={(event) => {
              const value = event.target.value;
              setSearchTerm(value);
              updateSearchParams(filterObjectId, value);
            }}
            placeholder="Поиск по помещению"
          />
        </div>

        <div className="row" style={{ flexWrap: "wrap" }}>
          <button className="btn btn-ghost" type="button" onClick={() => toggleVisible(true)} disabled={pending || !filterObjectId}>
            Выбрать все
          </button>
          <button className="btn btn-ghost" type="button" onClick={() => toggleVisible(false)} disabled={pending || !filterObjectId}>
            Снять все
          </button>
          <button className="btn btn-accent" type="button" onClick={handleSave} disabled={pending || !filterObjectId}>
            {pending ? "Сохранение..." : "Сохранить конфигурацию"}
          </button>
          <Link
            href={( `/rounds/qr${filterObjectId ? `?objectId=${encodeURIComponent(filterObjectId)}` : ""}`) as Route}
            className="btn btn-ghost"
            style={{ pointerEvents: !filterObjectId ? "none" : "auto", opacity: !filterObjectId ? 0.5 : 1 }}
          >
            Печать и выгрузка QR
          </Link>
        </div>

        <div className="text-soft">
          QR помещения создается автоматически при заведении помещения и не зависит от его участия в обходах.
        </div>

        {message ? <div className="text-soft">{message}</div> : null}
      </div>

      {!filterObjectId ? (
        <div className="section-card text-soft">
          Выберите объект для настройки обходов.
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
                { key: "enabled", label: "В обходах" },
                { key: "qr", label: "QR" },
              ]}
            >
              {filteredRooms.map((room) => {
                const enabled = enabledIds.has(room.id);
                return (
                  <tr key={room.id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{room.room_name}</div>
                      {searchTerm.trim() && <div className="text-soft">{room.floor_name}</div>}
                    </td>
                    <td>
                      <label className="row" style={{ gap: "0.45rem" }}>
                        <input type="checkbox" checked={enabled} onChange={() => toggleRoom(room.id)} />
                        <span>{enabled ? "Да" : "Нет"}</span>
                      </label>
                    </td>
                    <td>
                      {room.room_qr_token ? (
                        <div className="grid" style={{ gap: "0.35rem" }}>
                          <Badge tone="success">Общий QR готов</Badge>
                          <Link href={`/rounds/qr?objectId=${encodeURIComponent(room.object_id)}&roomId=${encodeURIComponent(room.id)}`} className="text-soft">
                            Просмотр
                          </Link>
                        </div>
                      ) : (
                        <Badge tone="warning">QR отсутствует</Badge>
                      )}
                    </td>
                  </tr>
                );
              })}
            </DataTable>
          </div>

          <div className="mobile-cards mobile-only">
            {filteredRooms.map((room) => {
              const enabled = enabledIds.has(room.id);
              return (
                <div key={room.id} className="section-card mobile-card grid" style={{ gap: "0.55rem" }}>
                  <div>
                    <div style={{ fontWeight: 600 }}>{room.room_name}</div>
                    {searchTerm.trim() && <div className="text-soft">{room.floor_name}</div>}
                  </div>
                  <label className="row" style={{ gap: "0.45rem" }}>
                    <input type="checkbox" checked={enabled} onChange={() => toggleRoom(room.id)} />
                    <span>{enabled ? "Участвует в обходах" : "Не участвует в обходах"}</span>
                  </label>
                  <div>
                    {room.room_qr_token ? <Badge tone="success">Общий QR готов</Badge> : <Badge tone="warning">QR отсутствует</Badge>}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
