"use client";

import { useEffect } from "react";
import { flushQueue } from "@/lib/offline/queue";

export function OfflineSyncBootstrap() {
  useEffect(() => {
    void flushQueue();
    const handleOnline = () => void flushQueue();
    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, []);

  return null;
}
