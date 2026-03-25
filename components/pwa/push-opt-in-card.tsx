"use client";

import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { ensureServiceWorkerRegistration } from "@/components/pwa/register-sw";

type PushState = "checking" | "ready" | "subscribed" | "blocked" | "unsupported";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

export function PushOptInCard() {
  const [state, setState] = useState<PushState>("checking");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadStatus() {
      if (!("serviceWorker" in navigator) || !("Notification" in window) || !("PushManager" in window)) {
        if (!cancelled) setState("unsupported");
        return;
      }

      try {
        const registration = await ensureServiceWorkerRegistration();
        const existing = await registration.pushManager.getSubscription();
        if (cancelled) return;

        if (existing) {
          setState("subscribed");
          return;
        }

        setState(Notification.permission === "denied" ? "blocked" : "ready");
      } catch {
        if (!cancelled) {
          setState("unsupported");
        }
      }
    }

    void loadStatus();
    return () => {
      cancelled = true;
    };
  }, []);

  function setInfo(nextMessage: string) {
    setMessage(nextMessage);
    setIsError(false);
  }

  function setError(nextMessage: string) {
    setMessage(nextMessage);
    setIsError(true);
  }

  async function enablePush() {
    setPending(true);
    setMessage(null);

    try {
      if (!("serviceWorker" in navigator) || !("Notification" in window) || !("PushManager" in window)) {
        setState("unsupported");
        setError("Этот браузер не поддерживает push-уведомления.");
        return;
      }

      const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapidPublicKey) {
        setError("Push-уведомления пока не настроены в окружении.");
        return;
      }

      const supabase = createSupabaseBrowserClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        setError("Включение push доступно только после входа в систему.");
        return;
      }

      if (Notification.permission === "denied") {
        setState("blocked");
        setError("Браузер уже запретил уведомления для этого сайта. Разрешите их в настройках сайта и попробуйте снова.");
        return;
      }

      const permission =
        Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "blocked" : "ready");
        setInfo("Разрешение на push-уведомления не выдано.");
        return;
      }

      const registration = await ensureServiceWorkerRegistration();
      const existing = await registration.pushManager.getSubscription();
      const subscription =
        existing ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as BufferSource,
        }));

      const response = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(subscription.toJSON()),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? "Не удалось сохранить push-подписку.");
      }

      setState("subscribed");
      setInfo("Push-уведомления включены для этого устройства.");
    } catch (error) {
      setError(error instanceof Error ? error.message : "Не удалось включить push-уведомления.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="section-card grid" style={{ gap: "0.8rem" }}>
      <div className="grid" style={{ gap: "0.25rem" }}>
        <strong>Push-уведомления</strong>
        <div className="text-soft">
          Подписка не включается автоматически. Разрешение будет запрошено только после вашего явного действия на этом устройстве.
        </div>
      </div>

      <div className="text-soft">
        {state === "checking"
          ? "Проверяем доступность push-уведомлений..."
          : state === "subscribed"
            ? "Push-уведомления уже включены для этого устройства."
            : state === "blocked"
              ? "Браузер заблокировал уведомления для сайта. Измените разрешение в настройках браузера."
              : state === "unsupported"
                ? "Этот браузер или устройство не поддерживает Web Push."
                : "Push-уведомления сейчас отключены. Вы можете включить их вручную."}
      </div>

      <div className="row" style={{ flexWrap: "wrap", gap: "0.65rem" }}>
        <button
          type="button"
          className="btn btn-accent"
          onClick={() => void enablePush()}
          disabled={pending || state === "subscribed" || state === "blocked" || state === "unsupported"}
        >
          {pending ? "Подключаем..." : state === "subscribed" ? "Push уже включён" : "Включить push-уведомления"}
        </button>
      </div>

      {message ? (
        <div className="text-soft" style={isError ? { color: "var(--danger)" } : undefined}>
          {message}
        </div>
      ) : null}
    </div>
  );
}
