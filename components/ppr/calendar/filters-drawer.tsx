"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { Route } from "next";
import type { CalendarObjectOption, CalendarSystemGroupOption, CalendarSystemOption } from "./types";

type DrawerProps = {
  objects: CalendarObjectOption[];
  systemGroups: CalendarSystemGroupOption[];
  systems: CalendarSystemOption[];
  initial: {
    year: number;
    month: string;
    objectId?: string;
    groupId?: string;
    systemId?: string;
    tab: "year" | "month";
  };
  onClose: () => void;
};

export function PprFiltersDrawer({ objects, systemGroups, systems, initial, onClose }: DrawerProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const params = new URLSearchParams(searchParams.toString());
    
    const year = formData.get("year") as string;
    if (year) params.set("year", year);
    
    const object = formData.get("object") as string;
    if (object) params.set("object", object);
    else params.delete("object");
    
    const group = formData.get("group") as string;
    if (group) params.set("group", group);
    else params.delete("group");
    
    const system = formData.get("system") as string;
    if (system) params.set("system", system);
    else params.delete("system");

    router.push(`${pathname}?${params.toString()}` as Route);
    onClose();
  };

  const handleReset = () => {
    const params = new URLSearchParams();
    params.set("tab", initial.tab);
    router.push(`${pathname}?${params.toString()}` as Route);
    onClose();
  };

  return (
    <div className="filters-overlay" onClick={onClose} role="presentation">
      <aside className="filters-drawer" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Фильтры календаря</h2>
          <button className="btn btn-ghost" type="button" onClick={onClose}>
            Закрыть
          </button>
        </div>

        <form className="grid" onSubmit={handleSubmit}>
          <label className="tl-filter-label">Год</label>
          <input className="input" type="number" min={2024} max={2100} name="year" defaultValue={initial.year} />

          <label className="tl-filter-label">Объект</label>
          <select className="select" name="object" defaultValue={initial.objectId ?? ""}>
            <option value="">Все объекты</option>
            {objects.map((obj) => (
              <option key={obj.id} value={obj.id}>{obj.name}</option>
            ))}
          </select>

          <label className="tl-filter-label">Группа систем</label>
          <select className="select" name="group" defaultValue={initial.groupId ?? ""}>
            <option value="">Все группы</option>
            {systemGroups.map((group) => (
              <option key={group.id} value={group.id}>{group.name}</option>
            ))}
          </select>

          <label className="tl-filter-label">Система</label>
          <select className="select" name="system" defaultValue={initial.systemId ?? ""}>
            <option value="">Все системы</option>
            {systems.map((system) => (
              <option key={system.id} value={system.id}>{system.name}</option>
            ))}
          </select>

          <div className="row filters-actions" style={{ marginTop: "1rem" }}>
            <button className="btn btn-accent" type="submit">Применить</button>
            <button className="btn btn-ghost" type="button" onClick={handleReset}>Сбросить</button>
          </div>
        </form>
      </aside>
    </div>
  );
}
