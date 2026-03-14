"use client";

import { useRouter } from "next/navigation";

type Props = {
  /** Fallback href navigated to when there is no browser history available. */
  fallback: string;
  label?: string;
};

/**
 * "← Назад" button.
 *
 * Strategy:
 * - If the page was opened from within the SPA (history.length > 1), calls
 *   router.back() for smooth client-side navigation.
 * - Otherwise navigates to `fallback` using router.push().
 */
export function BackButton({ fallback, label = "← Назад" }: Props) {
  const router = useRouter();

  function handleClick() {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      router.push(fallback as any);
    }
  }

  return (
    <button type="button" className="btn btn-ghost back-btn" onClick={handleClick}>
      {label}
    </button>
  );
}
