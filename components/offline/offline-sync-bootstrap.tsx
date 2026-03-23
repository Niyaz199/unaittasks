"use client";

import { useEffect } from "react";
import { flushQueue } from "@/lib/offline/queue";
import { flushRoundsQueue, pruneSyncedRoundsCheckins, retryErroredRoundsCheckins } from "@/lib/offline/rounds-queue";

export function OfflineSyncBootstrap() {
  useEffect(() => {
    const runSync = async () => {
      await pruneSyncedRoundsCheckins();
      await retryErroredRoundsCheckins();
      await Promise.all([flushQueue(), flushRoundsQueue()]);
    };

    void runSync();
    const handleOnline = () => void runSync();
    const handleFocus = () => void runSync();
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        void runSync();
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
