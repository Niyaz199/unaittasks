"use client";

import { useCallback, useEffect, useState } from "react";
import { flushRoundsQueue, getRoundsQueueSummary } from "@/lib/offline/rounds-queue";

type Summary = {
  pendingCount: number;
  errorCount: number;
  lastSyncedAt: string | null;
};

const initialSummary: Summary = {
  pendingCount: 0,
  errorCount: 0,
  lastSyncedAt: null,
};

export function RoundsSyncStatus() {
  const [summary, setSummary] = useState<Summary>(initialSummary);
  const [syncing, setSyncing] = useState(false);

  const refresh = useCallback(async () => {
    setSummary(await getRoundsQueueSummary());
  }, []);

  useEffect(() => {
    void refresh();
    const handleChange = () => void refresh();
    window.addEventListener("rounds-queue-changed", handleChange as EventListener);
    return () => window.removeEventListener("rounds-queue-changed", handleChange as EventListener);
  }, [refresh]);

  async function handleSync() {
    setSyncing(true);
    try {
      await flushRoundsQueue();
      await refresh();
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="section-card grid" style={{ gap: "0.65rem" }}>
      <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
        <div className="grid" style={{ gap: "0.3rem" }}>
          <strong>Синхронизация обходов</strong>
          <div className="text-soft">
            {summary.pendingCount > 0
              ? `В очереди ${summary.pendingCount} отметк${summary.pendingCount === 1 ? "а" : summary.pendingCount < 5 ? "и" : "ок"}`
              : "Очередь синхронизации пуста"}
          </div>
          {summary.errorCount > 0 ? (
            <div className="text-soft" style={{ color: "var(--warning)" }}>
              Ошибок синхронизации: {summary.errorCount}
            </div>
          ) : null}
          {summary.lastSyncedAt ? (
            <div className="text-soft">Последняя успешная синхронизация: {new Date(summary.lastSyncedAt).toLocaleString("ru-RU")}</div>
          ) : null}
        </div>
        <button className="btn btn-ghost" type="button" onClick={handleSync} disabled={syncing}>
          {syncing ? "Синхронизация..." : "Синхронизировать"}
        </button>
      </div>
    </div>
  );
}
