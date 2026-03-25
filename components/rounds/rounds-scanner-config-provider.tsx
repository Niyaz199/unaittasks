"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  loadRoundsScannerSnapshot,
  saveRoundsScannerSnapshot,
  type RoundsScannerSnapshot,
} from "@/lib/offline/rounds-queue";

type ScannerConfigApiPayload = {
  ok?: boolean;
  projectTimeZone?: string;
  scannerObjects?: Array<{ id: string; name: string }>;
  scannerRooms?: RoundsScannerSnapshot["rooms"];
};

type RoundsScannerConfigContextValue = {
  snapshot: RoundsScannerSnapshot | null;
  isLoading: boolean;
};

const RoundsScannerConfigContext = createContext<RoundsScannerConfigContextValue | null>(null);

export function RoundsScannerConfigProvider({ children }: { children: ReactNode }) {
  const [snapshot, setSnapshot] = useState<RoundsScannerSnapshot | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadConfig() {
      const localSnapshot = await loadRoundsScannerSnapshot();
      if (cancelled) return;

      if (localSnapshot) {
        setSnapshot(localSnapshot);
      }

      if (!navigator.onLine) {
        setIsLoading(false);
        return;
      }

      try {
        const response = await fetch("/api/rounds/config");
        const payload = (await response.json().catch(() => null)) as ScannerConfigApiPayload | null;
        if (!response.ok || !payload?.ok || cancelled) {
          setIsLoading(false);
          return;
        }

        const nextSnapshot: RoundsScannerSnapshot = {
          projectTimeZone: payload.projectTimeZone ?? "UTC",
          objects: payload.scannerObjects ?? [],
          rooms: payload.scannerRooms ?? [],
          updatedAt: new Date().toISOString(),
        };

        await saveRoundsScannerSnapshot(nextSnapshot);
        if (cancelled) return;

        setSnapshot(nextSnapshot);
      } catch {
        // Keep local snapshot when network refresh fails.
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadConfig();

    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo(
    () => ({
      snapshot,
      isLoading,
    }),
    [snapshot, isLoading]
  );

  return <RoundsScannerConfigContext.Provider value={value}>{children}</RoundsScannerConfigContext.Provider>;
}

export function useRoundsScannerConfig() {
  const value = useContext(RoundsScannerConfigContext);
  if (!value) {
    throw new Error("useRoundsScannerConfig must be used within RoundsScannerConfigProvider");
  }
  return value;
}
