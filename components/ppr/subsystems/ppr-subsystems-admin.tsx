"use client";

import { useState } from "react";
import { createPprSubsystemAction, updatePprSubsystemAction } from "@/app/actions/ppr-directory-actions";
import { DataTable } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { PprModal, PprFormGroup } from "@/components/ppr/ui/ppr-modal";

type SubsystemRow = {
  id: string;
  object_id: string;
  system_id: string;
  parent_id: string | null;
  name: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  object: { name: string } | Array<{ name: string }> | null;
  system: { name: string } | Array<{ name: string }> | null;
  parent: { name: string } | Array<{ name: string }> | null;
};

type ObjectOption = { id: string; name: string };
type SystemOption = { id: string; object_id: string; name: string };

function resolveName(raw: { name: string } | Array<{ name: string }> | null | undefined) {
  if (Array.isArray(raw)) return raw[0]?.name ?? "—";
  return raw?.name ?? "—";
}

export function PprSubsystemsAdmin({
  subsystems,
  objects,
  systems,
}: {
  subsystems: SubsystemRow[];
  objects: ObjectOption[];
  systems: SystemOption[];
}) {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);

  const editingSubsystem = editingId ? subsystems.find((item) => item.id === editingId) ?? null : null;
  const hasPrerequisites = objects.length > 0 && systems.length > 0;

  return (
    <>
      <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
        <div className="text-soft">Подсистемы создаются в рамках уже заведённых систем ППР.</div>
        <button className="btn btn-accent" type="button" onClick={() => setIsCreateOpen(true)} disabled={!hasPrerequisites}>
          + Добавить подсистему
        </button>
      </div>

      {!hasPrerequisites ? (
        <EmptyState
          message="Недостаточно данных для создания подсистемы"
          hint="Сначала должны существовать доступные объекты и хотя бы одна система ППР."
        />
      ) : !subsystems.length ? (
        <EmptyState message="Подсистемы ППР пока не созданы" hint="Добавьте первую подсистему для выбранной системы." />
      ) : (
        <>
          <div className="desktop-only">
            <DataTable
              columns={[
                { key: "object", label: "Объект" },
                { key: "system", label: "Система" },
                { key: "name", label: "Подсистема" },
                { key: "parent", label: "Родитель" },
                { key: "order", label: "Порядок" },
                { key: "actions", label: "Действия" },
              ]}
            >
              {subsystems.map((subsystem) => (
                <tr key={subsystem.id}>
                  <td>{resolveName(subsystem.object)}</td>
                  <td>{resolveName(subsystem.system)}</td>
                  <td>{subsystem.name}</td>
                  <td>{resolveName(subsystem.parent)}</td>
                  <td>{subsystem.sort_order}</td>
                  <td>
                    <div className="ppr-table-actions">
                      <button className="btn btn-ghost ppr-action-btn" type="button" onClick={() => setEditingId(subsystem.id)}>
                        Изменить
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </DataTable>
          </div>

          <div className="mobile-cards mobile-only">
            {subsystems.map((subsystem) => (
              <div key={subsystem.id} className="section-card mobile-card">
                <div className="grid" style={{ gap: "0.45rem" }}>
                  <div>{subsystem.name}</div>
                  <div className="text-soft">Объект: {resolveName(subsystem.object)}</div>
                  <div className="text-soft">Система: {resolveName(subsystem.system)}</div>
                  <div className="text-soft">Родитель: {resolveName(subsystem.parent)}</div>
                  <div className="text-soft">Порядок: {subsystem.sort_order}</div>
                  <div className="ppr-table-actions">
                    <button className="btn btn-ghost ppr-action-btn" type="button" onClick={() => setEditingId(subsystem.id)}>
                      Изменить
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <PprModal open={isCreateOpen} onClose={() => { setIsCreateOpen(false); setIsDirty(false); }} title="Новая подсистема ППР" isDirty={isDirty}>
        <form action={createPprSubsystemAction} onSubmit={() => { setIsCreateOpen(false); setIsDirty(false); }} onChange={() => setIsDirty(true)} className="ppr-modal-content">
          <div className="ppr-modal-body grid">
            <PprFormGroup label="Объект">
              <select className="select" name="object_id" required defaultValue="">
                <option value="" disabled>Выберите объект</option>
                {objects.map((item) => (
                  <option key={item.id} value={item.id}>{item.name}</option>
                ))}
              </select>
            </PprFormGroup>

            <PprFormGroup label="Система">
              <select className="select" name="system_id" required defaultValue="">
                <option value="" disabled>Выберите систему</option>
                {systems.map((system) => (
                  <option key={system.id} value={system.id}>{system.name}</option>
                ))}
              </select>
            </PprFormGroup>

            <PprFormGroup label="Родительская подсистема">
              <select className="select" name="parent_id" defaultValue="">
                <option value="">Без родителя</option>
                {subsystems.map((subsystem) => (
                  <option key={subsystem.id} value={subsystem.id}>{subsystem.name}</option>
                ))}
              </select>
            </PprFormGroup>

            <PprFormGroup label="Название подсистемы">
              <input className="input" name="name" placeholder="Например: Вытяжка 1 этажа" required />
            </PprFormGroup>
            
            <PprFormGroup label="Порядок сортировки">
              <input className="input" type="number" name="sort_order" min={0} defaultValue={0} />
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

      <PprModal open={Boolean(editingSubsystem)} onClose={() => { setEditingId(null); setIsDirty(false); }} title="Редактирование подсистемы ППР" isDirty={isDirty}>
        {editingSubsystem ? (
          <form action={updatePprSubsystemAction} onSubmit={() => { setEditingId(null); setIsDirty(false); }} onChange={() => setIsDirty(true)} className="ppr-modal-content">
            <div className="ppr-modal-body grid">
              <input type="hidden" name="subsystem_id" value={editingSubsystem.id} />

              <PprFormGroup label="Объект">
                <select className="select" name="object_id" required defaultValue={editingSubsystem.object_id}>
                  {objects.map((item) => (
                    <option key={item.id} value={item.id}>{item.name}</option>
                  ))}
                </select>
              </PprFormGroup>

              <PprFormGroup label="Система">
                <select className="select" name="system_id" required defaultValue={editingSubsystem.system_id}>
                  {systems.map((system) => (
                    <option key={system.id} value={system.id}>{system.name}</option>
                  ))}
                </select>
              </PprFormGroup>

              <PprFormGroup label="Родительская подсистема">
                <select className="select" name="parent_id" defaultValue={editingSubsystem.parent_id ?? ""}>
                  <option value="">Без родителя</option>
                  {subsystems
                    .filter((subsystem) => subsystem.id !== editingSubsystem.id)
                    .map((subsystem) => (
                      <option key={subsystem.id} value={subsystem.id}>{subsystem.name}</option>
                    ))}
                </select>
              </PprFormGroup>

              <PprFormGroup label="Название подсистемы">
                <input className="input" name="name" defaultValue={editingSubsystem.name} required />
              </PprFormGroup>
              
              <PprFormGroup label="Порядок сортировки">
                <input className="input" type="number" name="sort_order" min={0} defaultValue={editingSubsystem.sort_order} />
              </PprFormGroup>

              <label className="row" style={{ alignItems: "center", gap: "0.5rem" }}>
                <input type="checkbox" name="is_active" defaultChecked={editingSubsystem.is_active} />
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
