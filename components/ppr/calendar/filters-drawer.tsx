"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { Route } from "next";
import type { CalendarObjectOption, CalendarSystemGroupOption, CalendarSystemOption } from "./types";
import { AssigneeCombobox, type AssigneeOption } from "@/components/ui/assignee-combobox";

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
          <AssigneeCombobox
            name="object"
            placeholder="Все объекты"
            defaultValue={initial.objectId ?? ""}
            selectionHint="Выберите объект из списка"
            options={objects.map<AssigneeOption>((obj) => ({
              id: obj.id,
              label: obj.name,
            }))}
          />

          <label className="tl-filter-label">Группа систем</label>
          <AssigneeCombobox
            name="group"
            placeholder="Все группы"
            defaultValue={initial.groupId ?? ""}
            selectionHint="Выберите группу систем из списка"
            options={systemGroups.map<AssigneeOption>((group) => ({
              id: group.id,
              label: group.name,
            }))}
          />

          <label className="tl-filter-label">Система</label>
          <AssigneeCombobox
            name="system"
            placeholder="Все системы"
            defaultValue={initial.systemId ?? ""}
            selectionHint="Выберите систему из списка"
            options={systems.map<AssigneeOption>((system) => ({
              id: system.id,
              label: system.name,
            }))}
          />

          <div className="row filters-actions" style={{ marginTop: "1rem" }}>
            <button className="btn btn-accent" type="submit">Применить</button>
            <button className="btn btn-ghost" type="button" onClick={handleReset}>Сбросить</button>
          </div>
        </form>
      </aside>
    </div>
  );
}
