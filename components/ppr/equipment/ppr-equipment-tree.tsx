"use client";

import { useState, useMemo } from "react";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { StatusBadge } from "@/components/ppr/ui/status-badge";
import { pprEquipmentStatusMeta } from "@/lib/ppr/presentation";

type EquipmentRow = {
  id: string;
  object_id: string;
  system_id: string;
  room_id: string;
  inventory_no: string;
  name: string;
  dispatch_name: string;
  service_start_date: string;
  status: "active" | "repair" | "out_of_service" | "archived";
  serial_no: string | null;
  manufacturer: string | null;
  model: string | null;
  description: string | null;
  comment: string | null;
  created_at: string;
  object: { name: string } | Array<{ name: string }> | null;
  system: { name: string } | Array<{ name: string }> | null;
  room:
    | {
        name: string;
        floor: string | null;
        floor_ref: { name: string } | Array<{ name: string }> | null;
        room_type: { name: string } | Array<{ name: string }> | null;
      }
    | Array<{
        name: string;
        floor: string | null;
        floor_ref: { name: string } | Array<{ name: string }> | null;
        room_type: { name: string } | Array<{ name: string }> | null;
      }>
    | null;
};

type SystemOption = { id: string; object_id: string; name: string };

const EQUIPMENT_LABELS = {
  active: pprEquipmentStatusMeta.active.label,
  repair: pprEquipmentStatusMeta.repair.label,
  out_of_service: pprEquipmentStatusMeta.out_of_service.label,
  archived: pprEquipmentStatusMeta.archived.label,
};

function resolveName(raw: { name: string } | Array<{ name: string }> | null | undefined) {
  if (Array.isArray(raw)) return raw[0]?.name ?? "—";
  return raw?.name ?? "—";
}

function resolveRoomLabel(
  raw:
    | { name: string; floor: string | null; floor_ref: { name: string } | Array<{ name: string }> | null; room_type: { name: string } | Array<{ name: string }> | null }
    | Array<{ name: string; floor: string | null; floor_ref: { name: string } | Array<{ name: string }> | null; room_type: { name: string } | Array<{ name: string }> | null }>
    | null
    | undefined
) {
  const room = Array.isArray(raw) ? raw[0] : raw;
  if (!room) return "—";
  const floor = resolveName(room.floor_ref) !== "—" ? resolveName(room.floor_ref) : (room.floor ?? null);
  const roomType = resolveName(room.room_type);
  return [room.name, floor, roomType !== "—" ? roomType : null].filter(Boolean).join(" • ");
}

function ChevronIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{
        transition: "transform 200ms ease",
        transform: expanded ? "rotate(0deg)" : "rotate(-90deg)",
        flexShrink: 0,
      }}
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

function SystemStatusSummary({ items }: { items: EquipmentRow[] }) {
  const counts = useMemo(() => {
    const repair = items.filter((e) => e.status === "repair").length;
    const out = items.filter((e) => e.status === "out_of_service").length;
    return { repair, out };
  }, [items]);

  if (counts.repair === 0 && counts.out === 0) return null;

  return (
    <div className="row" style={{ gap: "0.5rem", flexShrink: 0 }}>
      {counts.repair > 0 && (
        <span
          style={{
            fontSize: "0.72rem",
            fontWeight: 600,
            padding: "0.15rem 0.5rem",
            borderRadius: 6,
            background: "color-mix(in srgb, var(--warning) 18%, transparent)",
            color: "var(--warning)",
            border: "1px solid color-mix(in srgb, var(--warning) 30%, transparent)",
          }}
        >
          {counts.repair} в ремонте
        </span>
      )}
      {counts.out > 0 && (
        <span
          style={{
            fontSize: "0.72rem",
            fontWeight: 600,
            padding: "0.15rem 0.5rem",
            borderRadius: 6,
            background: "color-mix(in srgb, var(--danger) 18%, transparent)",
            color: "var(--danger)",
            border: "1px solid color-mix(in srgb, var(--danger) 30%, transparent)",
          }}
        >
          {counts.out} выведено
        </span>
      )}
    </div>
  );
}

function CountBadge({ count }: { count: number }) {
  return (
    <span
      style={{
        fontSize: "0.72rem",
        fontWeight: 700,
        padding: "0.15rem 0.55rem",
        borderRadius: 20,
        background: "color-mix(in srgb, var(--accent) 16%, transparent)",
        color: "var(--accent)",
        border: "1px solid color-mix(in srgb, var(--accent) 28%, transparent)",
        flexShrink: 0,
        letterSpacing: "0.02em",
      }}
    >
      {count}
    </span>
  );
}

function SystemSection({
  system,
  items,
  expanded,
  onToggle,
  onEdit,
}: {
  system: SystemOption;
  items: EquipmentRow[];
  expanded: boolean;
  onToggle: () => void;
  onEdit: (id: string) => void;
}) {
  const router = useRouter();

  return (
    <div
      className="section-card"
      style={{ padding: 0, overflow: "hidden" }}
    >
      {/* System header */}
      <button
        type="button"
        onClick={onToggle}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          gap: "0.65rem",
          padding: "0.85rem 1rem",
          background: "none",
          border: "none",
          cursor: "pointer",
          color: "var(--text)",
          textAlign: "left",
          transition: "background 150ms ease",
          borderRadius: expanded ? "var(--radius) var(--radius) 0 0" : "var(--radius)",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.background =
            "color-mix(in srgb, var(--panel-soft) 60%, transparent)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.background = "none";
        }}
      >
        <ChevronIcon expanded={expanded} />

        <span style={{ fontWeight: 600, fontSize: "0.92rem", flex: 1, minWidth: 0 }}>
          {system.name}
        </span>

        <SystemStatusSummary items={items} />
        <CountBadge count={items.length} />
      </button>

      {/* Collapsible body — CSS grid trick for smooth animation */}
      <div
        style={{
          display: "grid",
          gridTemplateRows: expanded ? "1fr" : "0fr",
          transition: "grid-template-rows 200ms ease",
        }}
      >
        <div style={{ overflow: "hidden" }}>
          {/* Divider */}
          <div
            style={{
              height: 1,
              background: "color-mix(in srgb, var(--line) 60%, transparent)",
              margin: "0 0.5rem",
            }}
          />

          {/* Desktop table */}
          <div className="desktop-only" style={{ overflowX: "auto" }}>
            <table className="data-table" style={{ width: "100%" }}>
              <thead>
                <tr>
                  <th>Оборудование</th>
                  <th>Помещение</th>
                  <th>Статус</th>
                  <th>Действия</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr
                    key={item.id}
                    className="clickable-row"
                    onClick={() => router.push(`/ppr/equipment/${item.id}` as Route)}
                  >
                    <td>
                      <div style={{ fontWeight: 600 }}>{item.name}</div>
                      <div className="text-soft" style={{ fontSize: "0.83em" }}>
                        {item.dispatch_name}
                      </div>
                    </td>
                    <td className="text-soft" style={{ fontSize: "0.9em" }}>
                      {resolveRoomLabel(item.room)}
                    </td>
                    <td>
                      <StatusBadge status={item.status} labels={EQUIPMENT_LABELS} />
                    </td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <div className="ppr-table-actions">
                        <button
                          className="btn btn-ghost ppr-action-btn"
                          type="button"
                          onClick={() => onEdit(item.id)}
                        >
                          Изменить
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="mobile-only">
          <div style={{ display: "grid", gap: "0.5rem", padding: "0.75rem" }}>
            {items.map((item) => (
              <div
                key={item.id}
                style={{
                  background: "color-mix(in srgb, var(--panel-soft) 50%, transparent)",
                  border: "1px solid color-mix(in srgb, var(--line) 40%, transparent)",
                  borderRadius: 8,
                  padding: "0.75rem",
                  cursor: "pointer",
                  transition: "background 150ms ease",
                }}
                onClick={() => router.push(`/ppr/equipment/${item.id}` as Route)}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLDivElement).style.background =
                    "color-mix(in srgb, var(--panel-soft) 80%, transparent)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLDivElement).style.background =
                    "color-mix(in srgb, var(--panel-soft) 50%, transparent)";
                }}
              >
                <div className="grid" style={{ gap: "0.4rem" }}>
                  <div style={{ fontWeight: 600 }}>{item.name}</div>
                  <div className="text-soft" style={{ fontSize: "0.85em" }}>
                    {item.dispatch_name}
                  </div>
                  <div className="text-soft" style={{ fontSize: "0.85em" }}>
                    Помещение: {resolveRoomLabel(item.room)}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.5rem", marginTop: "0.15rem" }}>
                    <StatusBadge status={item.status} labels={EQUIPMENT_LABELS} />
                    <div onClick={(e) => e.stopPropagation()}>
                      <button
                        className="btn btn-ghost ppr-action-btn"
                        type="button"
                        onClick={() => onEdit(item.id)}
                      >
                        Изменить
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function PprEquipmentTree({
  equipment,
  systems,
  onEdit,
}: {
  equipment: EquipmentRow[];
  systems: SystemOption[];
  onEdit: (id: string) => void;
}) {
  const systemsWithItems = useMemo(() => {
    const grouped = new Map<string, EquipmentRow[]>();
    for (const item of equipment) {
      const list = grouped.get(item.system_id) ?? [];
      list.push(item);
      grouped.set(item.system_id, list);
    }

    const result: Array<{ system: SystemOption; items: EquipmentRow[] }> = [];

    for (const sys of systems) {
      const items = grouped.get(sys.id);
      if (items && items.length > 0) {
        result.push({ system: sys, items });
      }
    }

    // Equipment with unknown system_id (shouldn't happen but be safe)
    const knownIds = new Set(systems.map((s) => s.id));
    const orphaned = equipment.filter((e) => !knownIds.has(e.system_id));
    if (orphaned.length > 0) {
      result.push({
        system: { id: "__orphaned__", object_id: "", name: "Без системы" },
        items: orphaned,
      });
    }

    return result;
  }, [equipment, systems]);

  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set());

  const allExpanded = expandedIds.size === systemsWithItems.length;

  function toggleSystem(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function toggleAll() {
    if (allExpanded) {
      setExpandedIds(new Set());
    } else {
      setExpandedIds(new Set(systemsWithItems.map((s) => s.system.id)));
    }
  }

  if (systemsWithItems.length === 0) return null;

  return (
    <div className="grid" style={{ gap: "0.75rem" }}>
      {/* Expand/collapse all control */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end" }}>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={toggleAll}
          style={{ fontSize: "0.82rem", padding: "0.3rem 0.7rem" }}
        >
          {allExpanded ? "Свернуть все" : "Развернуть все"}
        </button>
      </div>

      {systemsWithItems.map(({ system, items }) => (
        <SystemSection
          key={system.id}
          system={system}
          items={items}
          expanded={expandedIds.has(system.id)}
          onToggle={() => toggleSystem(system.id)}
          onEdit={onEdit}
        />
      ))}
    </div>
  );
}
