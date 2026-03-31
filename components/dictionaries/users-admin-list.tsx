"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteUserAction, updateUserAction } from "@/app/actions/user-actions";
import { canAssignObjectsToManagedUser, canManageUserRole } from "@/lib/access/users";
import type { Role } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { Modal } from "@/components/ui/modal";

type UserRow = {
  id: string;
  full_name: string;
  email: string | null;
  role: Role;
};

type ObjectRow = {
  id: string;
  name: string;
};

type LinkRow = {
  user_id: string;
  object_id: string;
  object_name: string;
};

function roleTone(role: Role) {
  if (role === "admin") return "danger";
  if (role === "chief") return "warning";
  if (role === "lead") return "violet";
  if (role === "object_engineer") return "success";
  if (role === "tech") return "neutral";
  return "info";
}

function roleLabel(role: Role) {
  if (role === "admin") return "Администратор";
  if (role === "chief") return "Руководитель";
  if (role === "lead") return "Лид";
  if (role === "object_engineer") return "Инженер объекта";
  if (role === "tech") return "Техник";
  return "Инженер";
}

export function UsersAdminList({
  users,
  actorRole,
  availableRoles,
  objects,
  links,
  currentUserId,
}: {
  users: UserRow[];
  actorRole: Role;
  availableRoles: Role[];
  objects: ObjectRow[];
  links: LinkRow[];
  currentUserId: string;
}) {
  const router = useRouter();
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [editSuccess, setEditSuccess] = useState<string | null>(null);
  const [editPending, startEditTransition] = useTransition();

  const linksByUser = useMemo(() => {
    const map = new Map<string, { ids: Set<string>; names: string[] }>();
    for (const link of links) {
      const row = map.get(link.user_id) ?? { ids: new Set<string>(), names: [] };
      row.ids.add(link.object_id);
      row.names.push(link.object_name);
      map.set(link.user_id, row);
    }
    return map;
  }, [links]);

  const editingUser = editingUserId ? users.find((user) => user.id === editingUserId) ?? null : null;
  const deletingUser = deletingUserId ? users.find((user) => user.id === deletingUserId) ?? null : null;
  const canAssignObjects = editingRole ? canAssignObjectsToManagedUser(editingRole) : false;

  useEffect(() => {
    setEditingRole(editingUser?.role ?? null);
    setEditError(null);
  }, [editingUser]);

  if (!users.length) {
    return (
      <EmptyState
        message="Пользователи не найдены"
        hint="Добавьте первого пользователя и назначьте ему роль."
        actionLabel="+ Добавить пользователя"
        actionHref="/users/create"
      />
    );
  }

  return (
    <>
      {editSuccess ? (
        <div
          className="card"
          style={{ color: "#bbf7d0", background: "#153420", borderColor: "#166534" }}
        >
          {editSuccess}
        </div>
      ) : null}

      <div className="desktop-only">
        <DataTable
          columns={[
            { key: "name", label: "Пользователь" },
            { key: "role", label: "Роль" },
            { key: "objects", label: "Объекты" },
            { key: "actions", label: "Действия" },
          ]}
        >
          {users.map((user) => {
            const canManageTarget = canManageUserRole(actorRole, user.role);
            const isSelf = user.id === currentUserId;
            return (
              <tr key={user.id}>
                <td>{user.full_name}</td>
                <td>
                  <Badge tone={roleTone(user.role)}>{roleLabel(user.role)}</Badge>
                </td>
                <td>{(linksByUser.get(user.id)?.names ?? []).join(", ") || "—"}</td>
                <td>
                  {canManageTarget && !isSelf ? (
                    <div className="row">
                      <button className="btn btn-ghost" type="button" onClick={() => setEditingUserId(user.id)}>
                        {"Изменить"}
                      </button>
                      <button className="btn btn-danger" type="button" onClick={() => setDeletingUserId(user.id)}>
                        {"Удалить"}
                      </button>
                    </div>
                  ) : isSelf ? (
                    <span className="text-soft">{"Свой профиль редактируется в разделе Профиль"}</span>
                  ) : (
                    <span className="text-soft">{"Нет доступа"}</span>
                  )}
                </td>
              </tr>
            );
          })}
        </DataTable>
      </div>

      <div className="mobile-cards mobile-only">
        {users.map((user) => {
          const canManageTarget = canManageUserRole(actorRole, user.role);
          const isSelf = user.id === currentUserId;
          return (
            <div className="section-card mobile-card" key={user.id}>
              <div className="grid" style={{ gap: "0.45rem" }}>
                <div>{user.full_name}</div>
                <div className="text-soft">{user.email ?? "Email не задан"}</div>
                <div>
                  <Badge tone={roleTone(user.role)}>{roleLabel(user.role)}</Badge>
                </div>
                <div className="text-soft">{"Объекты:"} {(linksByUser.get(user.id)?.names ?? []).join(", ") || "—"}</div>
                {canManageTarget && !isSelf ? (
                  <div className="row">
                    <button className="btn btn-ghost" type="button" onClick={() => setEditingUserId(user.id)}>
                      {"Изменить"}
                    </button>
                    <button className="btn btn-danger" type="button" onClick={() => setDeletingUserId(user.id)}>
                      {"Удалить"}
                    </button>
                  </div>
                ) : isSelf ? (
                  <div className="text-soft">{"Свой профиль редактируется в разделе Профиль"}</div>
                ) : (
                  <div className="text-soft">{"Нет доступа к управлению"}</div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <Modal open={Boolean(editingUser)} onClose={() => setEditingUserId(null)} title={"Редактирование пользователя"}>
        {editingUser ? (
          <form
            className="grid"
            onSubmit={(event) => {
              event.preventDefault();
              const formData = new FormData(event.currentTarget);
              startEditTransition(async () => {
                setEditError(null);
                setEditSuccess(null);
                const result = await updateUserAction(formData);
                if (!result.ok) {
                  setEditError(result.error);
                  return;
                }
                setEditingUserId(null);
                setEditSuccess(result.message);
                router.refresh();
              });
            }}
          >
            <input type="hidden" name="user_id" value={editingUser.id} />
            <fieldset style={{ border: 0, padding: 0, margin: 0, display: "grid", gap: "1rem" }} disabled={editPending}>
              <div className="grid" style={{ gap: "0.75rem" }}>
                <div className="grid" style={{ gap: "0.2rem" }}>
                  <strong>Данные учетной записи</strong>
                  <div className="text-soft">ФИО, email и роль управляемой учетной записи.</div>
                </div>
                <div className="field-grid">
                  <label style={{ display: "grid", gap: "0.35rem" }}>
                    <span className="text-soft" style={{ fontSize: "0.78rem" }}>ФИО</span>
                    <input className="input" name="full_name" defaultValue={editingUser.full_name} required />
                  </label>
                  <label style={{ display: "grid", gap: "0.35rem" }}>
                    <span className="text-soft" style={{ fontSize: "0.78rem" }}>Email</span>
                    <input className="input" name="email" type="email" defaultValue={editingUser.email ?? ""} required />
                  </label>
                  <label style={{ display: "grid", gap: "0.35rem" }}>
                    <span className="text-soft" style={{ fontSize: "0.78rem" }}>Роль</span>
                    <select
                      className="select"
                      name="role"
                      value={editingRole ?? editingUser.role}
                      onChange={(event) => setEditingRole(event.target.value as Role)}
                    >
                      {availableRoles.map((role) => (
                        <option key={role} value={role}>
                          {roleLabel(role)}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </div>

              <div className="grid" style={{ gap: "0.75rem" }}>
                <div className="grid" style={{ gap: "0.2rem" }}>
                  <strong>Доступы</strong>
                  <div className="text-soft">Объекты доступны только для ролей, которым разрешены object links.</div>
                </div>
                {canAssignObjects ? (
                  <div className="row" style={{ flexWrap: "wrap" }}>
                    {objects.map((objectItem) => (
                      <label
                        key={objectItem.id}
                        className="badge badge-neutral"
                        style={{ display: "inline-flex", gap: 6, alignItems: "center" }}
                      >
                        <input
                          type="checkbox"
                          name="object_ids"
                          value={objectItem.id}
                          defaultChecked={linksByUser.get(editingUser.id)?.ids.has(objectItem.id)}
                        />
                        {objectItem.name}
                      </label>
                    ))}
                  </div>
                ) : (
                  <div className="text-soft">Для выбранной роли объектные доступы через это окно не настраиваются.</div>
                )}
              </div>

              <div className="grid" style={{ gap: "0.75rem" }}>
                <div className="grid" style={{ gap: "0.2rem" }}>
                  <strong>Безопасность</strong>
                  <div className="text-soft">Оставьте оба поля пустыми, если пароль менять не нужно.</div>
                </div>
                <div className="field-grid">
                  <label style={{ display: "grid", gap: "0.35rem" }}>
                    <span className="text-soft" style={{ fontSize: "0.78rem" }}>Новый пароль</span>
                    <input className="input" name="password" type="password" autoComplete="new-password" />
                  </label>
                  <label style={{ display: "grid", gap: "0.35rem" }}>
                    <span className="text-soft" style={{ fontSize: "0.78rem" }}>Подтверждение нового пароля</span>
                    <input className="input" name="password_confirm" type="password" autoComplete="new-password" />
                  </label>
                </div>
              </div>

              {editError ? (
                <div
                  className="card"
                  style={{ color: "#fecaca", background: "#3f1820", borderColor: "#7f1d1d" }}
                >
                  {editError}
                </div>
              ) : null}

              <div className="row" style={{ justifyContent: "space-between", flexWrap: "wrap" }}>
                <button className="btn btn-ghost" type="button" onClick={() => setEditingUserId(null)}>
                  {"Отмена"}
                </button>
                <button className="btn btn-accent" type="submit" disabled={editPending}>
                  {editPending ? "Сохраняем..." : "Сохранить"}
                </button>
              </div>
            </fieldset>
          </form>
        ) : null}
      </Modal>

      <Modal open={Boolean(deletingUser)} onClose={() => setDeletingUserId(null)} title={"Удалить пользователя?"}>
        {deletingUser ? (
          <form action={deleteUserAction} className="grid" onSubmit={() => setDeletingUserId(null)}>
            <input type="hidden" name="user_id" value={deletingUser.id} />
            <div className="text-soft">
              {"Пользователь:"} <strong>{deletingUser.full_name}</strong>
              {deletingUser.id === currentUserId ? " (это вы)" : ""}
            </div>
            <div className="text-soft">{"Если у пользователя есть связанные задачи, удаление будет отклонено."}</div>
            <div className="row">
              <button className="btn btn-danger" type="submit">
                {"Подтвердить удаление"}
              </button>
              <button className="btn btn-ghost" type="button" onClick={() => setDeletingUserId(null)}>
                {"Отмена"}
              </button>
            </div>
          </form>
        ) : null}
      </Modal>
    </>
  );
}
