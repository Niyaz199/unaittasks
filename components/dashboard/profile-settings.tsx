"use client";

import type { FormEvent } from "react";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateOwnProfileAction } from "@/app/actions/profile-actions";
import { Badge } from "@/components/ui/badge";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { Role } from "@/lib/types";

const MIN_PASSWORD_LENGTH = 8;

function roleTone(role: Role): "neutral" | "info" | "warning" | "success" | "danger" | "violet" {
  if (role === "admin") return "danger";
  if (role === "chief") return "warning";
  if (role === "lead") return "violet";
  if (role === "object_engineer") return "success";
  if (role === "tech") return "neutral";
  return "info";
}

function roleLabel(role: Role) {
  if (role === "admin") return "Администратор";
  if (role === "chief") return "Главный инженер";
  if (role === "lead") return "Ведущий инженер";
  if (role === "object_engineer") return "Инженер объекта";
  if (role === "tech") return "Техник";
  return "Инженер";
}

function mapPasswordError(message: string) {
  const normalized = message.toLowerCase();

  if (normalized.includes("invalid login credentials")) {
    return "Текущий пароль указан неверно.";
  }

  if (normalized.includes("same") && normalized.includes("password")) {
    return "Новый пароль должен отличаться от текущего.";
  }

  return message;
}

function StatusMessage({ message, tone }: { message: string; tone: "success" | "danger" }) {
  return (
    <div
      className="profile-status"
      style={
        tone === "success"
          ? { color: "#bbf7d0", background: "#153420", borderColor: "#166534" }
          : { color: "#fecaca", background: "#3f1820", borderColor: "#7f1d1d" }
      }
    >
      {message}
    </div>
  );
}

export function ProfileSettings({
  initialFullName,
  email,
  role,
}: {
  initialFullName: string;
  email: string;
  role: Role;
}) {
  const router = useRouter();
  const [fullName, setFullName] = useState(initialFullName);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileSuccess, setProfileSuccess] = useState<string | null>(null);
  const [profilePending, startProfileTransition] = useTransition();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
  const [passwordPending, setPasswordPending] = useState(false);

  function handleProfileSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const trimmedFullName = String(formData.get("full_name") ?? "").trim();

    if (!trimmedFullName) {
      setProfileSuccess(null);
      setProfileError("Введите ФИО.");
      return;
    }

    formData.set("full_name", trimmedFullName);

    startProfileTransition(async () => {
      setProfileError(null);
      setProfileSuccess(null);

      const result = await updateOwnProfileAction(formData);
      if (!result.ok) {
        setProfileError(result.error);
        return;
      }

      setFullName(result.fullName);
      setProfileSuccess(result.message);
      router.refresh();
    });
  }

  async function handlePasswordSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(null);

    if (!currentPassword) {
      setPasswordError("Введите текущий пароль.");
      return;
    }

    if (!newPassword) {
      setPasswordError("Введите новый пароль.");
      return;
    }

    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      setPasswordError(`Новый пароль должен быть не короче ${MIN_PASSWORD_LENGTH} символов.`);
      return;
    }

    if (confirmPassword !== newPassword) {
      setPasswordError("Подтверждение пароля не совпадает.");
      return;
    }

    if (!email) {
      setPasswordError("Не удалось определить email текущего пользователя.");
      return;
    }

    setPasswordPending(true);

    try {
      const supabase = createSupabaseBrowserClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password: currentPassword
      });

      if (signInError) {
        setPasswordError(mapPasswordError(signInError.message));
        return;
      }

      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
      if (updateError) {
        setPasswordError(mapPasswordError(updateError.message));
        return;
      }

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordSuccess("Пароль успешно изменен.");
      router.refresh();
    } catch (error) {
      setPasswordError(error instanceof Error ? mapPasswordError(error.message) : "Не удалось изменить пароль.");
    } finally {
      setPasswordPending(false);
    }
  }

  return (
    <div className="grid profile-sections">
      <form className="section-card grid profile-panel" onSubmit={handleProfileSubmit}>
        <div className="grid" style={{ gap: "0.3rem" }}>
          <strong className="profile-panel-title">Личные данные</strong>
          <div className="text-soft">Изменения применяются только к вашей учетной записи.</div>
        </div>

        <div className="field-grid">
          <label className="profile-field">
            <span className="profile-field-label">ФИО</span>
            <input
              className="input"
              name="full_name"
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              autoComplete="name"
              disabled={profilePending}
              required
            />
          </label>

          <label className="profile-field">
            <span className="profile-field-label">Email</span>
            <input className="input" value={email} readOnly aria-readonly="true" autoComplete="email" />
          </label>

          <div className="profile-field">
            <span className="profile-field-label">Роль</span>
            <div className="row" style={{ minHeight: "44px" }}>
              <Badge tone={roleTone(role)}>{roleLabel(role)}</Badge>
            </div>
          </div>
        </div>

        {profileError ? <StatusMessage message={profileError} tone="danger" /> : null}
        {profileSuccess ? <StatusMessage message={profileSuccess} tone="success" /> : null}

        <div className="row" style={{ justifyContent: "space-between", alignItems: "center", flexWrap: "wrap" }}>
          <div className="text-soft">Email, роль и объектные доступы через этот экран не меняются.</div>
          <button className="btn btn-accent" type="submit" disabled={profilePending}>
            {profilePending ? "Сохраняем..." : "Сохранить"}
          </button>
        </div>
      </form>

      <form className="section-card grid profile-panel" onSubmit={(event) => void handlePasswordSubmit(event)}>
        <div className="grid" style={{ gap: "0.3rem" }}>
          <strong className="profile-panel-title">Смена пароля</strong>
          <div className="text-soft">Пароль обновляется через Supabase Auth для текущей сессии.</div>
        </div>

        <div className="field-grid">
          <label className="profile-field">
            <span className="profile-field-label">Текущий пароль</span>
            <input
              className="input"
              type="password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              autoComplete="current-password"
              disabled={passwordPending}
              required
            />
          </label>

          <label className="profile-field">
            <span className="profile-field-label">Новый пароль</span>
            <input
              className="input"
              type="password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              autoComplete="new-password"
              disabled={passwordPending}
              required
            />
          </label>

          <label className="profile-field">
            <span className="profile-field-label">Повторите новый пароль</span>
            <input
              className="input"
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              autoComplete="new-password"
              disabled={passwordPending}
              required
            />
          </label>
        </div>

        <div className="text-soft">Минимальная длина нового пароля: {MIN_PASSWORD_LENGTH} символов.</div>

        {passwordError ? <StatusMessage message={passwordError} tone="danger" /> : null}
        {passwordSuccess ? <StatusMessage message={passwordSuccess} tone="success" /> : null}

        <div className="row" style={{ justifyContent: "flex-end" }}>
          <button className="btn btn-accent" type="submit" disabled={passwordPending}>
            {passwordPending ? "Меняем пароль..." : "Изменить пароль"}
          </button>
        </div>
      </form>
    </div>
  );
}
