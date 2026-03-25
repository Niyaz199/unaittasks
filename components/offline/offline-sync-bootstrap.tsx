"use client";

import { useEffect } from "react";
import { runOfflineSync } from "@/lib/offline/sync-coordinator";

export function OfflineSyncBootstrap() {
  useEffect(() => {
    const runSync = () => void runOfflineSync().catch(() => undefined);

    runSync();
    const handleOnline = () => runSync();
    const handleFocus = () => runSync();
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        runSync();
      }
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []);

  return null;
}
