"use client";

import type { Route } from "next";
import { useEffect, useMemo, useState } from "react";
import { createPprSystemAction, updatePprSystemAction } from "@/app/actions/ppr-directory-actions";
import { DataTable } from "@/components/ui/data-table";
import { PprModal, PprFormGroup } from "@/components/ppr/ui/ppr-modal";
import { PprPageShell } from "@/components/ppr/ui/ppr-page-shell";
import { StatusBadge } from "@/components/ppr/ui/status-badge";

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
  const roleRu = value.role === "lead" ? "вед. инженер" : value.role === "object_engineer" ? "инженер объекта" : "инженер";
  return `${value.full_name} — ${roleRu}`;
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

  // Filter states
  const [searchTerm, setSearchTerm] = useState("");
  const [filterObjectId, setFilterObjectId] = useState("");
  const [filterGroupId, setFilterGroupId] = useState("");
  const [filterResponsibleId, setFilterResponsibleId] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "active" | "inactive">("all");

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

  // Filter logic
  const filteredSystems = useMemo(() => {
    return systems.filter((system) => {
      const matchesSearch =
        searchTerm === "" ||
        system.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        resolveName(system.system_group).toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesObject = filterObjectId === "" || system.object_id === filterObjectId;
      const matchesGroup = filterGroupId === "" || system.system_group_id === filterGroupId;
      const matchesResponsible = filterResponsibleId === "" || system.responsible_user_id === filterResponsibleId;
      const matchesStatus =
        filterStatus === "all" ||
        (filterStatus === "active" && system.is_active) ||
        (filterStatus === "inactive" && !system.is_active);

      return matchesSearch && matchesObject && matchesGroup && matchesResponsible && matchesStatus;
    });
  }, [systems, searchTerm, filterObjectId, filterGroupId, filterResponsibleId, filterStatus]);

  // Summary metrics
  const metrics = useMemo(() => {
    const total = systems.length;
    const active = systems.filter((s) => s.is_active).length;
    
    // Top groups by count
    const groupCounts = systems.reduce((acc, system) => {
      const groupName = resolveName(system.system_group);
      acc[groupName] = (acc[groupName] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    const topGroup = Object.entries(groupCounts)
      .sort(([, a], [, b]) => b - a)[0];

    return [
      { label: "Всего систем", value: total, tone: "neutral" as const },
      { label: "Активных", value: active, tone: "success" as const },
      { 
        label: "Самая крупная группа", 
        value: topGroup ? `${topGroup[0]} (${topGroup[1]})` : "—", 
        tone: "info" as const 
      },
    ];
  }, [systems]);

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
      <PprPageShell
        metrics={metrics}
        onSearch={setSearchTerm}
        searchPlaceholder="Поиск по названию или группе..."
        isEmpty={!hasPrerequisites || systems.length === 0}
        emptyState={{
          message: !hasPrerequisites ? "Недостаточно данных для создания системы" : "Системы не найдены",
          hint: !hasPrerequisites 
            ? (!objects.length ? "Для начала нужен хотя бы один доступный объект." : "Для начала нужна хотя бы одна группа систем ППР.")
            : "Создайте первую систему ППР для доступного объекта.",
          actionLabel: !hasPrerequisites && !systemGroups.length && canManageSystemGroups ? "Открыть справочник групп" : undefined,
          actionHref: !hasPrerequisites && !systemGroups.length && canManageSystemGroups ? ("/ppr/system-groups" as Route) : undefined,
        }}
        isFilteredEmpty={filteredSystems.length === 0}
        filters={
          <>
            <select
              className="select"
              value={filterObjectId}
              onChange={(e) => setFilterObjectId(e.target.value)}
              style={{ maxWidth: "200px" }}
            >
              <option value="">Все объекты</option>
              {objects.map((obj) => (
                <option key={obj.id} value={obj.id}>
                  {obj.name}
                </option>
              ))}
            </select>

            <select
              className="select"
              value={filterGroupId}
              onChange={(e) => setFilterGroupId(e.target.value)}
              style={{ maxWidth: "200px" }}
            >
              <option value="">Все группы</option>
              {systemGroups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name}
                </option>
              ))}
            </select>

            <select
              className="select"
              value={filterResponsibleId}
              onChange={(e) => setFilterResponsibleId(e.target.value)}
              style={{ maxWidth: "200px" }}
            >
              <option value="">Все ответственные</option>
              {responsibleCandidates.map((resp) => (
                <option key={resp.id} value={resp.id}>
                  {resp.full_name}
                </option>
              ))}
            </select>

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

            <button className="btn btn-accent" type="button" onClick={() => setIsCreateOpen(true)} disabled={!hasPrerequisites}>
              + Добавить
            </button>
          </>
        }
      >
        <div className="desktop-only">
          <DataTable
            columns={[
              { key: "name", label: "Система" },
              { key: "object", label: "Объект" },
              { key: "group", label: "Группа" },
              { key: "responsible", label: "Ответственный" },
              { key: "status", label: "Статус" },
              { key: "actions", label: "Действия" },
            ]}
          >
            {filteredSystems.map((system) => (
              <tr key={system.id}>
                <td style={{ fontWeight: 600 }}>{system.name}</td>
                <td>{resolveName(system.object)}</td>
                <td>{resolveName(system.system_group)}</td>
                <td>{resolveResponsible(system.responsible)}</td>
                <td><StatusBadge isActive={system.is_active} /></td>
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
          {filteredSystems.map((system) => (
            <div key={system.id} className="section-card mobile-card">
              <div className="grid" style={{ gap: "0.45rem" }}>
                <div style={{ fontWeight: 600 }}>{system.name}</div>
                <div className="text-soft">Объект: {resolveName(system.object)}</div>
                <div className="text-soft">Группа: {resolveName(system.system_group)}</div>
                <div className="text-soft">Ответственный: {resolveResponsible(system.responsible)}</div>
                <div><StatusBadge isActive={system.is_active} /></div>
                <div className="ppr-table-actions">
                  <button className="btn btn-ghost ppr-action-btn" type="button" onClick={() => setEditingId(system.id)}>
                    Изменить
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </PprPageShell>

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
                    {candidate.full_name} — {roleLabel(candidate.role)}
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
                      {candidate.full_name} — {roleLabel(candidate.role)}
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
