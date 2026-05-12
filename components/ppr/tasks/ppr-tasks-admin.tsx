"use client";

import { useMemo, useState } from "react";
import { PprTaskList } from "@/components/ppr/tasks/ppr-task-list";
import { PprPageShell } from "@/components/ppr/ui/ppr-page-shell";
import { pprTaskStatusMeta } from "@/lib/ppr/presentation";
import type { PprTaskSummaryRow } from "@/lib/ppr/queries";
import { AssigneeCombobox, type AssigneeOption } from "@/components/ui/assignee-combobox";

export function PprTasksAdmin({
  tasks,
  emptyMessage,
  emptyHint,
}: {
  tasks: PprTaskSummaryRow[];
  emptyMessage: string;
  emptyHint?: string;
}) {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterObjectId, setFilterObjectId] = useState("");
  const [filterSystemId, setFilterSystemId] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  const objects = useMemo(() => {
    const map = new Map<string, string>();
    for (const task of tasks) {
      if (task.object_id && task.object && !Array.isArray(task.object)) {
        map.set(task.object_id, task.object.name);
      }
    }
    return Array.from(map.entries()).map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [tasks]);

  const systems = useMemo(() => {
    const map = new Map<string, string>();
    for (const task of tasks) {
      if ((!filterObjectId || task.object_id === filterObjectId) && task.system_id && task.system && !Array.isArray(task.system)) {
        map.set(task.system_id, task.system.name);
      }
    }
    return Array.from(map.entries()).map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [tasks, filterObjectId]);

  const statuses = useMemo(() => {
    const set = new Set<string>();
    for (const task of tasks) {
      set.add(task.status);
    }
    return Array.from(set);
  }, [tasks]);

  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      const equipName = !Array.isArray(task.equipment) ? task.equipment?.name : "";
      const equipInv = !Array.isArray(task.equipment) ? task.equipment?.inventory_no : "";
      const searchLower = searchTerm.toLowerCase();
      
      const matchesSearch =
        searchTerm === "" ||
        (equipName && equipName.toLowerCase().includes(searchLower)) ||
        (equipInv && equipInv.toLowerCase().includes(searchLower));
        
      const matchesObject = filterObjectId === "" || task.object_id === filterObjectId;
      const matchesSystem = filterSystemId === "" || task.system_id === filterSystemId;
      const matchesStatus = filterStatus === "" || task.status === filterStatus;

      return matchesSearch && matchesObject && matchesSystem && matchesStatus;
    });
  }, [tasks, searchTerm, filterObjectId, filterSystemId, filterStatus]);

  const metrics = useMemo(() => {
    const total = tasks.length;
    const overdue = tasks.filter((t) => t.is_overdue).length;
    const inProgress = tasks.filter((t) => t.status === "in_progress").length;
    const done = tasks.filter((t) => t.status === "done").length;

    const res: Array<{ label: string; value: number; tone: "neutral" | "danger" | "info" | "success" }> = [
      { label: "Всего заявок", value: total, tone: "neutral" },
    ];
    
    if (overdue > 0) {
      res.push({ label: "Просрочено", value: overdue, tone: "danger" });
    }
    if (inProgress > 0) {
      res.push({ label: "В работе", value: inProgress, tone: "info" });
    }
    if (done > 0) {
      res.push({ label: "Выполнено", value: done, tone: "success" });
    }
    
    return res;
  }, [tasks]);

  return (
    <PprPageShell
      metrics={metrics}
      onSearch={setSearchTerm}
      searchPlaceholder="Поиск по оборудованию или инв. номеру..."
      isEmpty={tasks.length === 0}
      emptyState={{
        message: emptyMessage,
        hint: emptyHint,
      }}
      isFilteredEmpty={filteredTasks.length === 0}
      filters={
        <>
          {objects.length > 1 && (
            <div style={{ maxWidth: "240px", width: "100%" }}>
              <AssigneeCombobox
                name="filter_object_id"
                placeholder="Все объекты"
                defaultValue={filterObjectId}
                selectionHint="Выберите объект из списка"
                options={objects.map<AssigneeOption>((obj) => ({
                  id: obj.id,
                  label: obj.name,
                }))}
                onSelectedIdChange={(id) => {
                  setFilterObjectId(id);
                  setFilterSystemId("");
                }}
              />
            </div>
          )}

          {systems.length > 1 && (
            <div style={{ maxWidth: "240px", width: "100%" }}>
              <AssigneeCombobox
                key={`filter-system-${filterObjectId || "any"}`}
                name="filter_system_id"
                placeholder="Все системы"
                defaultValue={filterSystemId}
                selectionHint="Выберите систему из списка"
                options={systems.map<AssigneeOption>((sys) => ({
                  id: sys.id,
                  label: sys.name,
                }))}
                onSelectedIdChange={(id) => setFilterSystemId(id)}
              />
            </div>
          )}

          {statuses.length > 1 && (
            <select
              className="select"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              style={{ maxWidth: "150px" }}
            >
              <option value="">Все статусы</option>
              {statuses.map((status) => (
                <option key={status} value={status}>
                  {pprTaskStatusMeta[status as keyof typeof pprTaskStatusMeta]?.label || status}
                </option>
              ))}
            </select>
          )}
        </>
      }
    >
      <PprTaskList tasks={filteredTasks} emptyMessage={emptyMessage} emptyHint={emptyHint} />
    </PprPageShell>
  );
}
