"use client";

import { useEffect } from "react";

export async function ensureServiceWorkerRegistration() {
  if (!("serviceWorker" in navigator)) {
    throw new Error("Service Worker не поддерживается в этом браузере.");
  }

  const existing = await navigator.serviceWorker.getRegistration();
  if (existing) return existing;

  return navigator.serviceWorker.register("/sw.js");
}

export function RegisterSW() {
  useEffect(() => {
    void ensureServiceWorkerRegistration().catch(() => {
      // Ignore registration failures here. Push opt-in handles user-facing messaging.
    });
  }, []);

  return null;
}
