"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

export function LoginForm({ initialError }: { initialError?: string | null }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(initialError ?? null);

  async function onSubmit(formData: FormData) {
    setLoading(true);
    setError(null);
    const email = String(formData.get("email") ?? "");
    const password = String(formData.get("password") ?? "");

    const supabase = createSupabaseBrowserClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);

    if (signInError) {
      setError(signInError.message);
      return;
    }

    router.push("/my");
    router.refresh();
  }

  return (
    <form className="grid card" action={onSubmit} style={{ maxWidth: 420, margin: "10vh auto" }}>
      <h1 style={{ margin: 0 }}>Задачник эксплуатации</h1>
      <p className="text-soft" style={{ margin: 0 }}>
        Вход по email и паролю (Supabase Auth)
      </p>
      <input className="input" name="email" type="email" placeholder="Email" required />
      <input className="input" name="password" type="password" placeholder="Пароль" required />
      {error ? (
        <div className="card" style={{ borderColor: "#7f1d1d", color: "#fca5a5" }}>
          {error}
        </div>
      ) : null}
      <button className="btn btn-accent" type="submit" disabled={loading}>
        {loading ? "Входим..." : "Войти"}
      </button>
    </form>
  );
}
