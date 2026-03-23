"use client";

import Link from "next/link";
import type { Route } from "next";
import { useMemo, useState, useTransition } from "react";
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

export function RoundsConfigAdmin({ objects, rooms, initialObjectId = "", initialQuery = "" }: Props) {
  const router = useRouter();
  const [filterObjectId, setFilterObjectId] = useState(initialObjectId);
  const [searchTerm, setSearchTerm] = useState(initialQuery);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [enabledIds, setEnabledIds] = useState(() => new Set(rooms.filter((room) => room.rounds_enabled).map((room) => room.id)));

  const filteredRooms = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return rooms.filter((room) => {
      const matchesObject = filterObjectId === "" || room.object_id === filterObjectId;
      const matchesQuery = query === "" || room.room_name.toLowerCase().includes(query);
      return matchesObject && matchesQuery;
    });
  }, [filterObjectId, rooms, searchTerm]);

  const activeObjectId = filterObjectId || filteredRooms[0]?.object_id || "";

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
    if (!activeObjectId) {
      setMessage("Выберите объект для сохранения конфигурации.");
      return;
    }

    const enabledRoomIds = rooms.filter((room) => room.object_id === activeObjectId && enabledIds.has(room.id)).map((room) => room.id);
    startTransition(async () => {
      setMessage(null);
      const response = await fetch("/api/rounds/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ objectId: activeObjectId, enabledRoomIds }),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        setMessage(payload.error ?? "Не удалось сохранить конфигурацию обходов.");
        return;
      }
      setMessage("Конфигурация сохранена.");
      router.refresh();
    });
  }

  async function handleGenerateMissing() {
    if (!activeObjectId) {
      setMessage("Выберите объект для генерации QR.");
      return;
    }
    startTransition(async () => {
      setMessage(null);
      const response = await fetch("/api/rounds/qr/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ objectId: activeObjectId, missingOnly: true }),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string; updatedRoomIds?: string[] };
      if (!response.ok) {
        setMessage(payload.error ?? "Не удалось сгенерировать QR.");
        return;
      }
      setMessage(payload.updatedRoomIds?.length ? `Сгенерировано QR: ${payload.updatedRoomIds.length}` : "Все QR уже были сгенерированы.");
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
            <option value="">Все объекты</option>
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
          <button className="btn btn-ghost" type="button" onClick={() => toggleVisible(true)} disabled={pending}>
            Выбрать все
          </button>
          <button className="btn btn-ghost" type="button" onClick={() => toggleVisible(false)} disabled={pending}>
            Снять все
          </button>
          <button className="btn btn-ghost" type="button" onClick={handleGenerateMissing} disabled={pending || !activeObjectId}>
            Сгенерировать отсутствующие QR
          </button>
          <button className="btn btn-accent" type="button" onClick={handleSave} disabled={pending || !activeObjectId}>
            {pending ? "Сохранение..." : "Сохранить конфигурацию"}
          </button>
          <Link href={( `/rounds/qr${activeObjectId ? `?objectId=${encodeURIComponent(activeObjectId)}` : ""}`) as Route} className="btn btn-ghost">
            Печать и выгрузка QR
          </Link>
        </div>

        {message ? <div className="text-soft">{message}</div> : null}
      </div>

      <div className="desktop-only">
        <DataTable
          columns={[
            { key: "object", label: "Объект" },
            { key: "floor", label: "Этаж" },
            { key: "room", label: "Помещение" },
            { key: "enabled", label: "В обходах" },
            { key: "qr", label: "QR" },
          ]}
        >
          {filteredRooms.map((room) => {
            const enabled = enabledIds.has(room.id);
            return (
              <tr key={room.id}>
                <td>{room.object_name}</td>
                <td>{room.floor_name}</td>
                <td style={{ fontWeight: 600 }}>{room.room_name}</td>
                <td>
                  <label className="row" style={{ gap: "0.45rem" }}>
                    <input type="checkbox" checked={enabled} onChange={() => toggleRoom(room.id)} />
                    <span>{enabled ? "Да" : "Нет"}</span>
                  </label>
                </td>
                <td>
                  {room.rounds_qr_token ? (
                    <div className="grid" style={{ gap: "0.35rem" }}>
                      <Badge tone="success">QR готов</Badge>
                      <Link href={`/rounds/qr?objectId=${encodeURIComponent(room.object_id)}&roomId=${encodeURIComponent(room.id)}`} className="text-soft">
                        Просмотр
                      </Link>
                    </div>
                  ) : (
                    <Badge tone="warning">Нет QR</Badge>
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
              <div style={{ fontWeight: 600 }}>{room.room_name}</div>
              <div className="text-soft">{room.object_name} • {room.floor_name}</div>
              <label className="row" style={{ gap: "0.45rem" }}>
                <input type="checkbox" checked={enabled} onChange={() => toggleRoom(room.id)} />
                <span>{enabled ? "Участвует в обходах" : "Не участвует в обходах"}</span>
              </label>
              <div>
                {room.rounds_qr_token ? <Badge tone="success">QR готов</Badge> : <Badge tone="warning">QR отсутствует</Badge>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
