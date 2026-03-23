"use client";

import { useState, useMemo } from "react";
import { createPprSystemGroupAction, updatePprSystemGroupAction } from "@/app/actions/ppr-directory-actions";
import { DataTable } from "@/components/ui/data-table";
import { PprModal, PprFormGroup } from "@/components/ppr/ui/ppr-modal";
import { PprPageShell } from "@/components/ppr/ui/ppr-page-shell";
import { StatusBadge } from "@/components/ppr/ui/status-badge";

type SystemGroupRow = {
  id: string;
  name: string;
  code: string;
  is_active: boolean;
};

export function PprSystemGroupsAdmin({ groups }: { groups: SystemGroupRow[] }) {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);

  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "active" | "inactive">("all");

  const editingGroup = editingId ? groups.find((item) => item.id === editingId) ?? null : null;

  const filteredGroups = useMemo(() => {
    return groups.filter((group) => {
      const matchesSearch =
        searchTerm === "" ||
        group.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        group.code.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesStatus =
        filterStatus === "all" ||
        (filterStatus === "active" && group.is_active) ||
        (filterStatus === "inactive" && !group.is_active);

      return matchesSearch && matchesStatus;
    });
  }, [groups, searchTerm, filterStatus]);

  const metrics = useMemo(() => {
    return [
      { label: "Всего групп", value: groups.length, tone: "neutral" as const },
      { label: "Активных", value: groups.filter((g) => g.is_active).length, tone: "success" as const },
    ];
  }, [groups]);

  return (
    <>
      <PprPageShell
        metrics={metrics}
        onSearch={setSearchTerm}
        searchPlaceholder="Поиск по названию или коду..."
        isEmpty={groups.length === 0}
        emptyState={{
          message: "Справочник групп систем ППР пуст",
          hint: "Создайте первую группу, чтобы на странице `/ppr/systems` можно было добавлять системы без ручного SQL.",
        }}
        isFilteredEmpty={filteredGroups.length === 0}
        filters={
          <>
            <select
              className="select"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as "all" | "active" | "inactive")}
              style={{ maxWidth: "150px" }}
            >
              <option value="all">Все статусы</option>
              <option value="active">Активные</option>
              <option value="inactive">Неактивные</option>
            </select>
            <button className="btn btn-accent" type="button" onClick={() => setIsCreateOpen(true)}>
              + Добавить
            </button>
          </>
        }
      >
        <div className="desktop-only">
          <DataTable
            columns={[
              { key: "name", label: "Название" },
              { key: "code", label: "Код" },
              { key: "status", label: "Статус" },
              { key: "actions", label: "Действия" },
            ]}
          >
            {filteredGroups.map((group) => (
              <tr key={group.id}>
                <td style={{ fontWeight: 600 }}>{group.name}</td>
                <td>{group.code}</td>
                <td><StatusBadge isActive={group.is_active} /></td>
                <td>
                  <div className="ppr-table-actions">
                    <button className="btn btn-ghost ppr-action-btn" type="button" onClick={() => setEditingId(group.id)}>
                      Изменить
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </DataTable>
        </div>

        <div className="mobile-cards mobile-only">
          {filteredGroups.map((group) => (
            <div key={group.id} className="section-card mobile-card">
              <div className="grid" style={{ gap: "0.45rem" }}>
                <div style={{ fontWeight: 600 }}>{group.name}</div>
                <div className="text-soft">Код: {group.code}</div>
                <div><StatusBadge isActive={group.is_active} /></div>
                <div className="ppr-table-actions">
                  <button className="btn btn-ghost ppr-action-btn" type="button" onClick={() => setEditingId(group.id)}>
                    Изменить
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </PprPageShell>

      <PprModal open={isCreateOpen} onClose={() => setIsCreateOpen(false)} title="Новая группа систем ППР" isDirty={isDirty}>
        <form action={createPprSystemGroupAction} onSubmit={() => { setIsCreateOpen(false); setIsDirty(false); }} onChange={() => setIsDirty(true)} className="ppr-modal-content">
          <div className="ppr-modal-body grid">
            <PprFormGroup label="Название группы">
              <input className="input" name="name" placeholder="Название группы" required />
            </PprFormGroup>
            
            <PprFormGroup label="Код группы">
              <input className="input" name="code" placeholder="Например: HVAC" required />
            </PprFormGroup>

            <label className="row" style={{ alignItems: "center", gap: "0.5rem" }}>
              <input type="checkbox" name="is_active" defaultChecked />
              Активна
            </label>
          </div>

          <div className="ppr-modal-footer">
            <button className="btn btn-accent" type="submit">Создать</button>
          </div>
        </form>
      </PprModal>

      <PprModal open={Boolean(editingGroup)} onClose={() => { setEditingId(null); setIsDirty(false); }} title="Редактирование группы систем ППР" isDirty={isDirty}>
        {editingGroup ? (
          <form action={updatePprSystemGroupAction} onSubmit={() => { setEditingId(null); setIsDirty(false); }} onChange={() => setIsDirty(true)} className="ppr-modal-content">
            <div className="ppr-modal-body grid">
              <input type="hidden" name="system_group_id" value={editingGroup.id} />
              
              <PprFormGroup label="Название группы">
                <input className="input" name="name" defaultValue={editingGroup.name} required />
              </PprFormGroup>
              
              <PprFormGroup label="Код группы">
                <input className="input" name="code" defaultValue={editingGroup.code} required />
              </PprFormGroup>

              <label className="row" style={{ alignItems: "center", gap: "0.5rem" }}>
                <input type="checkbox" name="is_active" defaultChecked={editingGroup.is_active} />
                Активна
              </label>
            </div>

            <div className="ppr-modal-footer">
              <button className="btn btn-accent" type="submit">Сохранить</button>
            </div>
          </form>
        ) : null}
      </PprModal>
    </>
  );
}
