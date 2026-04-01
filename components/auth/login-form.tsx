"use client";

import { useActionState } from "react";
import { signInAction } from "@/app/actions/auth-actions";

export function LoginForm({ initialError }: { initialError?: string | null }) {
  const [state, formAction, loading] = useActionState(signInAction, {
    error: initialError ?? null
  });

  return (
    <form className="grid card" action={formAction} style={{ maxWidth: 420, margin: "10vh auto" }}>
      <h1 style={{ margin: 0 }}>Задачник эксплуатации</h1>
      <p className="text-soft" style={{ margin: 0 }}>
        Вход по email и паролю (Supabase Auth)
      </p>
      <input className="input" name="email" type="email" placeholder="Email" required />
      <input className="input" name="password" type="password" placeholder="Пароль" required />
      {state.error ? (
        <div className="card" style={{ borderColor: "#7f1d1d", color: "#fca5a5" }}>
          {state.error}
        </div>
      ) : null}
      <button className="btn btn-accent" type="submit" disabled={loading}>
        {loading ? "Входим..." : "Войти"}
      </button>
    </form>
  );
}
