"use client";

import { signOutAction } from "@/app/actions/auth-actions";

export function SignOutButton() {
  function handleClick(event: React.MouseEvent<HTMLButtonElement>) {
    if (!window.confirm("Выйти из системы?")) {
      event.preventDefault();
    }
  }

  return (
    <form action={signOutAction}>
      <button className="btn" type="submit" onClick={handleClick}>
        Выйти
      </button>
    </form>
  );
}
