"use client";

import type { Route } from "next";
import { useEffect, useMemo, useState } from "react";
import { createPprSystemAction, updatePprSystemAction } from "@/app/actions/ppr-directory-actions";
import { DataTable } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { PprModal, PprFormGroup } from "@/components/ppr/ui/ppr-modal";

type SystemRow = {
  id: string;
  object_id: string;
  system_group_id: string;
  name: string;
  description: string | null;
  responsible_user_id: string | null;
  is_active: boolean;
  created_at: string;
  object: { name: string } | Array<{ name: string }> | null;
  system_group: { name: string } | Array<{ name: string }> | null;
  responsible: { full_name: string; role: string } | Array<{ full_name: string; role: string }> | null;
};

type ObjectOption = { id: string; name: string };
type GroupOption = { id: string; name: string; code: string; is_active: boolean };
type ResponsibleOption = { id: string; full_name: string; role: "lead" | "engineer" | "object_engineer"; object_ids: string[] };

function resolveName(raw: { name: string } | Array<{ name: string }> | null | undefined) {
  if (Array.isArray(raw)) return raw[0]?.name ?? "—";
  return raw?.name ?? "—";
}

function resolveResponsible(
  raw: { full_name: string; role: string } | Array<{ full_name: string; role: string }> | null | undefined
) {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value) return "—";
  return `${value.full_name} (${value.role})`;
}

function roleLabel(role: ResponsibleOption["role"]) {
  if (role === "lead") return "ведущий инженер";
  if (role === "object_engineer") return "объектовый инженер";
  return "инженер";
}

export function PprSystemsAdmin({
  systems,
  objects,
  systemGroups,
  responsibleCandidates,
  canManageSystemGroups,
}: {
  systems: SystemRow[];
  objects: ObjectOption[];
  systemGroups: GroupOption[];
  responsibleCandidates: ResponsibleOption[];
  canManageSystemGroups: boolean;
}) {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [createObjectId, setCreateObjectId] = useState("");
  const [createResponsibleUserId, setCreateResponsibleUserId] = useState("");
  const [editObjectId, setEditObjectId] = useState("");
  const [editResponsibleUserId, setEditResponsibleUserId] = useState("");

  const editingSystem = editingId ? systems.find((item) => item.id === editingId) ?? null : null;
  const hasPrerequisites = objects.length > 0 && systemGroups.length > 0;

  const objectMap = useMemo(() => new Map(objects.map((item) => [item.id, item.name])), [objects]);
  const createResponsibleCandidates = useMemo(
    () =>
      createObjectId
        ? responsibleCandidates.filter((candidate) => candidate.object_ids.includes(createObjectId))
        : [],
    [createObjectId, responsibleCandidates]
  );
  const editResponsibleCandidates = useMemo(
    () =>
      editObjectId
        ? responsibleCandidates.filter((candidate) => candidate.object_ids.includes(editObjectId))
        : [],
    [editObjectId, responsibleCandidates]
  );

  useEffect(() => {
    if (!isCreateOpen) {
      setCreateObjectId("");
      setCreateResponsibleUserId("");
    }
  }, [isCreateOpen]);

  useEffect(() => {
    setIsDirty(false);
  }, [isCreateOpen, editingId]);

  useEffect(() => {
    setEditObjectId(editingSystem?.object_id ?? "");
    setEditResponsibleUserId(editingSystem?.responsible_user_id ?? "");
  }, [editingSystem]);

  useEffect(() => {
    setCreateResponsibleUserId("");
  }, [createObjectId]);

  useEffect(() => {
    if (!editObjectId) {
      setEditResponsibleUserId("");
      return;
    }

    const stillAllowed = editResponsibleCandidates.some((candidate) => candidate.id === editResponsibleUserId);
    if (!stillAllowed) {
      setEditResponsibleUserId("");
    }
  }, [editObjectId, editResponsibleCandidates, editResponsibleUserId]);

  return (
    <>
      <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
        <div className="text-soft">
          Системы ППР внутри объектов. Ответственный выбирается только из `lead`, `engineer`, `object_engineer`.
        </div>
        <button className="btn btn-accent" type="button" onClick={() => setIsCreateOpen(true)} disabled={!hasPrerequisites}>
          + Добавить систему
        </button>
      </div>

      {!hasPrerequisites ? (
        <EmptyState
          message="Недостаточно данных для создания системы"
          hint={
            !objects.length
              ? "Для начала нужен хотя бы один доступный объект."
              : "Для начала нужна хотя бы одна группа систем ППР."
          }
          actionLabel={!systemGroups.length && canManageSystemGroups ? "Открыть справочник групп" : undefined}
          actionHref={!systemGroups.length && canManageSystemGroups ? ("/ppr/system-groups" as Route) : undefined}
        />
      ) : !systems.length ? (
        <EmptyState message="Список систем ППР пуст" hint="Создайте первую систему ППР для доступного объекта." />
      ) : (
        <>
          <div className="desktop-only">
            <DataTable
              columns={[
                { key: "object", label: "Объект" },
                { key: "group", label: "Группа" },
                { key: "name", label: "Система" },
                { key: "responsible", label: "Ответственный" },
                { key: "status", label: "Статус" },
                { key: "actions", label: "Действия" },
              ]}
            >
              {systems.map((system) => (
                <tr key={system.id}>
                  <td>{resolveName(system.object)}</td>
                  <td>{resolveName(system.system_group)}</td>
                  <td>{system.name}</td>
                  <td>{resolveResponsible(system.responsible)}</td>
                  <td>{system.is_active ? "Активна" : "Отключена"}</td>
                  <td>
                    <div className="ppr-table-actions">
                      <button className="btn btn-ghost ppr-action-btn" type="button" onClick={() => setEditingId(system.id)}>
                        Изменить
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </DataTable>
          </div>

          <div className="mobile-cards mobile-only">
            {systems.map((system) => (
              <div key={system.id} className="section-card mobile-card">
                <div className="grid" style={{ gap: "0.45rem" }}>
                  <div>{system.name}</div>
                  <div className="text-soft">Объект: {resolveName(system.object)}</div>
                  <div className="text-soft">Группа: {resolveName(system.system_group)}</div>
                  <div className="text-soft">Ответственный: {resolveResponsible(system.responsible)}</div>
                  <div className="text-soft">{system.is_active ? "Активна" : "Отключена"}</div>
                  <div className="ppr-table-actions">
                    <button className="btn btn-ghost ppr-action-btn" type="button" onClick={() => setEditingId(system.id)}>
                      Изменить
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <PprModal open={isCreateOpen} onClose={() => setIsCreateOpen(false)} title="Новая система ППР" isDirty={isDirty}>
        <form action={createPprSystemAction} onSubmit={() => setIsCreateOpen(false)} onChange={() => setIsDirty(true)} className="ppr-modal-content">
          <div className="ppr-modal-body grid">
            <PprFormGroup label="Объект">
              <select
                className="select"
                name="object_id"
                required
                value={createObjectId}
                onChange={(event) => setCreateObjectId(event.target.value)}
              >
                <option value="" disabled>Выберите объект</option>
                {objects.map((item) => (
                  <option key={item.id} value={item.id}>{item.name}</option>
                ))}
              </select>
            </PprFormGroup>

            <PprFormGroup label="Группа систем">
              <select className="select" name="system_group_id" required defaultValue="">
                <option value="" disabled>Выберите группу систем</option>
                {systemGroups.filter((group) => group.is_active).map((group) => (
                  <option key={group.id} value={group.id}>{group.name}</option>
                ))}
              </select>
            </PprFormGroup>

            <PprFormGroup label="Название системы">
              <input className="input" name="name" placeholder="Например: Вентиляция корпуса А" required />
            </PprFormGroup>
            
            <PprFormGroup label="Описание (необязательно)">
              <textarea className="input" name="description" rows={3} placeholder="Дополнительная техническая информация..." />
            </PprFormGroup>

            <PprFormGroup label="Ответственный инженер">
              <select
                className="select"
                name="responsible_user_id"
                value={createResponsibleUserId}
                onChange={(event) => setCreateResponsibleUserId(event.target.value)}
              >
                <option value="">Без ответственного</option>
                {createResponsibleCandidates.map((candidate) => (
                  <option key={candidate.id} value={candidate.id}>
                    {candidate.full_name} ({roleLabel(candidate.role)})
                    {candidate.object_ids.length ? ` · ${candidate.object_ids.map((id) => objectMap.get(id) ?? id).join(", ")}` : ""}
                  </option>
                ))}
              </select>
            </PprFormGroup>

            <label className="row" style={{ alignItems: "center", gap: "0.5rem", marginTop: "0.5rem" }}>
              <input type="checkbox" name="is_active" defaultChecked />
              Активна
            </label>
          </div>
          <div className="ppr-modal-footer">
            <button className="btn btn-accent" type="submit">Создать систему</button>
          </div>
        </form>
      </PprModal>

      <PprModal open={Boolean(editingSystem)} onClose={() => setEditingId(null)} title="Редактирование системы ППР" isDirty={isDirty}>
        {editingSystem ? (
          <form action={updatePprSystemAction} onSubmit={() => setEditingId(null)} onChange={() => setIsDirty(true)} className="ppr-modal-content">
            <div className="ppr-modal-body grid">
              <input type="hidden" name="system_id" value={editingSystem.id} />

              <PprFormGroup label="Объект">
                <select
                  className="select"
                  name="object_id"
                  required
                  value={editObjectId}
                  onChange={(event) => setEditObjectId(event.target.value)}
                >
                  {objects.map((item) => (
                    <option key={item.id} value={item.id}>{item.name}</option>
                  ))}
                </select>
              </PprFormGroup>

              <PprFormGroup label="Группа систем">
                <select className="select" name="system_group_id" required defaultValue={editingSystem.system_group_id}>
                  {systemGroups.map((group) => (
                    <option key={group.id} value={group.id}>{group.name}</option>
                  ))}
                </select>
              </PprFormGroup>

              <PprFormGroup label="Название системы">
                <input className="input" name="name" defaultValue={editingSystem.name} required />
              </PprFormGroup>
              
              <PprFormGroup label="Описание">
                <textarea className="input" name="description" rows={3} defaultValue={editingSystem.description ?? ""} />
              </PprFormGroup>

              <PprFormGroup label="Ответственный инженер">
                <select
                  className="select"
                  name="responsible_user_id"
                  value={editResponsibleUserId}
                  onChange={(event) => setEditResponsibleUserId(event.target.value)}
                >
                  <option value="">Без ответственного</option>
                  {editResponsibleCandidates.map((candidate) => (
                    <option key={candidate.id} value={candidate.id}>
                      {candidate.full_name} ({roleLabel(candidate.role)})
                      {candidate.object_ids.length ? ` · ${candidate.object_ids.map((id) => objectMap.get(id) ?? id).join(", ")}` : ""}
                    </option>
                  ))}
                </select>
              </PprFormGroup>

              <label className="row" style={{ alignItems: "center", gap: "0.5rem", marginTop: "0.5rem" }}>
                <input type="checkbox" name="is_active" defaultChecked={editingSystem.is_active} />
                Активна
              </label>
            </div>
            
            <div className="ppr-modal-footer">
              <button className="btn btn-accent" type="submit">Сохранить изменения</button>
            </div>
          </form>
        ) : null}
      </PprModal>
    </>
  );
}
