"use client";

import { useMemo, useState } from "react";
import { deleteUserAction, updateUserAction } from "@/app/actions/user-actions";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { Modal } from "@/components/ui/modal";

type UserRow = {
  id: string;
  full_name: string;
  role: "admin" | "chief" | "lead" | "engineer" | "object_engineer" | "tech";
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

function roleTone(role: UserRow["role"]) {
  if (role === "admin") return "danger";
  if (role === "chief") return "warning";
  if (role === "lead") return "violet";
  if (role === "object_engineer") return "success";
  if (role === "tech") return "neutral";
  return "info";
}

function roleLabel(role: UserRow["role"]) {
  if (role === "admin") return "Админ";
  if (role === "chief") return "Руководитель";
  if (role === "lead") return "Лид";
  if (role === "object_engineer") return "Инженер объекта";
  if (role === "tech") return "Техник";
  return "Инженер";
}

export function UsersAdminList({
  users,
  objects,
  links,
  currentUserId
}: {
  users: UserRow[];
  objects: ObjectRow[];
  links: LinkRow[];
  currentUserId: string;
}) {
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);

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
      <div className="desktop-only">
        <DataTable
          columns={[
            { key: "name", label: "Пользователь" },
            { key: "role", label: "Роль" },
            { key: "objects", label: "Объекты" },
            { key: "actions", label: "Действия" }
          ]}
        >
          {users.map((user) => (
            <tr key={user.id}>
              <td>{user.full_name}</td>
              <td>
                <Badge tone={roleTone(user.role)}>{roleLabel(user.role)}</Badge>
              </td>
              <td>{(linksByUser.get(user.id)?.names ?? []).join(", ") || "—"}</td>
              <td>
                <div className="row">
                  <button className="btn btn-ghost" type="button" onClick={() => setEditingUserId(user.id)}>
                    Изменить
                  </button>
                  <button className="btn btn-danger" type="button" onClick={() => setDeletingUserId(user.id)}>
                    Удалить
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </DataTable>
      </div>

      <div className="mobile-cards mobile-only">
        {users.map((user) => (
          <div className="section-card mobile-card" key={user.id}>
            <div className="grid" style={{ gap: "0.45rem" }}>
              <div>{user.full_name}</div>
              <div>
                <Badge tone={roleTone(user.role)}>{roleLabel(user.role)}</Badge>
              </div>
              <div className="text-soft">Объекты: {(linksByUser.get(user.id)?.names ?? []).join(", ") || "—"}</div>
              <div className="row">
                <button className="btn btn-ghost" type="button" onClick={() => setEditingUserId(user.id)}>
                  Изменить
                </button>
                <button className="btn btn-danger" type="button" onClick={() => setDeletingUserId(user.id)}>
                  Удалить
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <Modal open={Boolean(editingUser)} onClose={() => setEditingUserId(null)} title="Редактирование пользователя">
        {editingUser ? (
          <form action={updateUserAction} className="grid" onSubmit={() => setEditingUserId(null)}>
            <input type="hidden" name="user_id" value={editingUser.id} />
            <div className="field-row">
              <input className="input" name="full_name" defaultValue={editingUser.full_name} required />
              <select className="select" name="role" defaultValue={editingUser.role}>
                <option value="admin">admin</option>
                <option value="chief">chief</option>
                <option value="lead">lead</option>
                <option value="engineer">engineer</option>
                <option value="object_engineer">object_engineer</option>
                <option value="tech">tech</option>
              </select>
            </div>
            <div className="grid">
              <div className="text-soft">Объекты инженера:</div>
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
            </div>
            <div className="row">
              <button className="btn btn-accent" type="submit">
                Сохранить
              </button>
            </div>
          </form>
        ) : null}
      </Modal>

      <Modal open={Boolean(deletingUser)} onClose={() => setDeletingUserId(null)} title="Удалить пользователя?">
        {deletingUser ? (
          <form action={deleteUserAction} className="grid" onSubmit={() => setDeletingUserId(null)}>
            <input type="hidden" name="user_id" value={deletingUser.id} />
            <div className="text-soft">
              Пользователь: <strong>{deletingUser.full_name}</strong>
              {deletingUser.id === currentUserId ? " (это вы)" : ""}
            </div>
            <div className="text-soft">Если у пользователя есть связанные задачи, удаление будет отклонено.</div>
            <div className="row">
              <button className="btn btn-danger" type="submit">
                Подтвердить удаление
              </button>
              <button className="btn btn-ghost" type="button" onClick={() => setDeletingUserId(null)}>
                Отмена
              </button>
            </div>
          </form>
        ) : null}
      </Modal>
    </>
  );
}
