"use client";

import { useMemo, useState } from "react";
import { createUserAction } from "@/app/actions/user-actions";
import { canAssignObjectsToManagedUser } from "@/lib/access/users";
import type { Role } from "@/lib/types";

type ObjectRow = {
  id: string;
  name: string;
};

export function CreateUserForm({
  availableRoles,
  objects,
}: {
  availableRoles: Role[];
  objects: ObjectRow[];
}) {
  const [selectedRole, setSelectedRole] = useState<Role>(availableRoles[0] ?? "tech");
  const canAssignObjects = useMemo(() => canAssignObjectsToManagedUser(selectedRole), [selectedRole]);

  return (
    <form className="section-card grid" action={createUserAction}>
      <div className="field-row">
        <input className="input" name="email" placeholder="Email" type="email" required />
        <input className="input" name="password" placeholder="Пароль (>=8)" required />
      </div>
      <div className="field-row">
        <input className="input" name="full_name" placeholder="ФИО" required />
        <select
          className="select"
          name="role"
          value={selectedRole}
          onChange={(event) => setSelectedRole(event.target.value as Role)}
        >
          {availableRoles.map((role) => (
            <option key={role} value={role}>
              {role}
            </option>
          ))}
        </select>
      </div>
      {canAssignObjects ? (
        <div className="grid">
          <div className="text-soft" style={{ fontSize: "0.85rem" }}>Объекты управляемого пользователя:</div>
          <div className="row" style={{ flexWrap: "wrap", gap: "0.5rem" }}>
            {objects.map((objectItem) => (
              <label
                key={objectItem.id}
                className="badge badge-neutral"
                style={{ 
                  display: "inline-flex", 
                  gap: "0.4rem", 
                  alignItems: "center",
                  padding: "0.4rem 0.8rem",
                  cursor: "pointer",
                  borderRadius: "8px",
                  border: "1px solid color-mix(in srgb, var(--line) 50%, transparent)"
                }}
              >
                <input type="checkbox" name="object_ids" value={objectItem.id} style={{ accentColor: "var(--accent)" }} />
                {objectItem.name}
              </label>
            ))}
          </div>
        </div>
      ) : null}
      <div className="row">
        <button className="btn btn-accent" type="submit">
          Создать пользователя
        </button>
      </div>
    </form>
  );
}
