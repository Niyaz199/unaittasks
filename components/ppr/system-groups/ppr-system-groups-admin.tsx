"use client";

import { useState } from "react";
import { createPprSystemGroupAction, updatePprSystemGroupAction } from "@/app/actions/ppr-directory-actions";
import { DataTable } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { PprModal, PprFormGroup } from "@/components/ppr/ui/ppr-modal";

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

  const editingGroup = editingId ? groups.find((item) => item.id === editingId) ?? null : null;

  return (
    <>
      <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
        <div className="text-soft">Глобальный справочник групп систем ППР для последующего выбора в карточке системы.</div>
        <button className="btn btn-accent" type="button" onClick={() => setIsCreateOpen(true)}>
          + Добавить группу
        </button>
      </div>

      {!groups.length ? (
        <EmptyState
          message="Справочник групп систем ППР пуст"
          hint="Создайте первую группу, чтобы на странице `/ppr/systems` можно было добавлять системы без ручного SQL."
        />
      ) : (
        <>
          <div className="desktop-only">
            <DataTable
              columns={[
                { key: "name", label: "Название" },
                { key: "code", label: "Код" },
                { key: "status", label: "Статус" },
                { key: "actions", label: "Действия" },
              ]}
            >
              {groups.map((group) => (
                <tr key={group.id}>
                  <td>{group.name}</td>
                  <td>{group.code}</td>
                  <td>{group.is_active ? "Активна" : "Отключена"}</td>
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
            {groups.map((group) => (
              <div key={group.id} className="section-card mobile-card">
                <div className="grid" style={{ gap: "0.45rem" }}>
                  <div>{group.name}</div>
                  <div className="text-soft">Код: {group.code}</div>
                  <div className="text-soft">{group.is_active ? "Активна" : "Отключена"}</div>
                  <div className="ppr-table-actions">
                    <button className="btn btn-ghost ppr-action-btn" type="button" onClick={() => setEditingId(group.id)}>
                      Изменить
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

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
