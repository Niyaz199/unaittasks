"use client";

import localforage from "localforage";

export type OfflineRoundsPhoto = {
  blob: Blob;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
};

export type PendingRoundsCheckin = {
  id: string;
  type: "rounds_checkin";
  clientEventId: string;
  roomId: string;
  objectId: string;
  roomQrToken: string;
  scannedAtDevice: string;
  operationalDate: string;
  userId: string;
  comment: string;
  photo: OfflineRoundsPhoto | null;
  syncStatus: "pending" | "syncing" | "synced" | "error";
  syncError: string | null;
  createdAt: string;
  syncedAt: string | null;
};

export type RoundsScannerSnapshot = {
  projectTimeZone: string;
  objects: Array<{ id: string; name: string }>;
  rooms: Array<{
    room_id: string;
    object_id: string;
    object_name: string;
    room_name: string;
    floor_name: string;
    qr_token: string;
  }>;
  updatedAt: string;
};

type QueueMeta = {
  lastSyncedAt: string | null;
};

type ApiErrorPayload = {
  error?: string;
  details?: string | Record<string, unknown> | null;
  hint?: string | null;
};

const queueStorage = localforage.createInstance({
  name: "ops-tasker",
  storeName: "rounds_pending_checkins",
});

const snapshotStorage = localforage.createInstance({
  name: "ops-tasker",
  storeName: "rounds_snapshot",
});

function emitRoundsQueueChanged() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("rounds-queue-changed"));
  }
}

async function getQueue() {
  try {
    return (await queueStorage.getItem<PendingRoundsCheckin[]>("queue")) ?? [];
  } catch (error) {
    console.error("Failed to read rounds queue from IndexedDB:", error);
    return [];
  }
}

async function setQueue(queue: PendingRoundsCheckin[]) {
  try {
    await queueStorage.setItem("queue", queue);
    emitRoundsQueueChanged();
  } catch (error) {
    console.error("Failed to write rounds queue to IndexedDB:", error);
  }
}

async function getMeta(): Promise<QueueMeta> {
  try {
    return (await queueStorage.getItem<QueueMeta>("meta")) ?? { lastSyncedAt: null };
  } catch (error) {
    console.error("Failed to read rounds meta from IndexedDB:", error);
    return { lastSyncedAt: null };
  }
}

async function setMeta(meta: QueueMeta) {
  try {
    await queueStorage.setItem("meta", meta);
    emitRoundsQueueChanged();
  } catch (error) {
    console.error("Failed to write rounds meta to IndexedDB:", error);
  }
}

async function readApiError(response: Response, fallback: string) {
  const payload = (await response.json().catch(() => null)) as ApiErrorPayload | null;
  if (payload?.error?.trim()) return payload.error.trim();
  if (payload?.hint?.trim()) return payload.hint.trim();
  return fallback;
}

function buildCheckinFormData(entry: PendingRoundsCheckin) {
  const formData = new FormData();
  formData.set("room_id", entry.roomId);
  formData.set("client_event_id", entry.clientEventId);
  formData.set("scanned_at_device", entry.scannedAtDevice);
  formData.set("comment", entry.comment);
  formData.set("source", "pwa-offline");
  if (entry.photo) {
    formData.append("photo", entry.photo.blob, entry.photo.fileName);
  }
  return formData;
}

export async function enqueueRoundsCheckin(
  entry: Omit<PendingRoundsCheckin, "id" | "type" | "syncStatus" | "syncError" | "createdAt" | "syncedAt">
) {
  const queue = await getQueue();
  queue.push({
    id: crypto.randomUUID(),
    type: "rounds_checkin",
    syncStatus: "pending",
    syncError: null,
    createdAt: new Date().toISOString(),
    syncedAt: null,
    ...entry,
  });
  await setQueue(queue);
}

export async function getRoundsQueueItems() {
  return getQueue();
}

export async function getRoundsQueueSummary() {
  const [queue, meta] = await Promise.all([getQueue(), getMeta()]);
  return {
    pendingCount: queue.filter((item) => item.syncStatus === "pending" || item.syncStatus === "syncing" || item.syncStatus === "error").length,
    errorCount: queue.filter((item) => item.syncStatus === "error").length,
    lastSyncedAt: meta.lastSyncedAt,
  };
}

export async function flushRoundsQueue() {
  if (!navigator.onLine) return;

  const queue = await getQueue();
  let changed = false;

  for (const entry of queue) {
    if (entry.syncStatus === "synced") continue;

    entry.syncStatus = "syncing";
    entry.syncError = null;
    changed = true;
    await setQueue([...queue]);

    try {
      const response = await fetch("/api/rounds/checkins", {
        method: "POST",
        body: buildCheckinFormData(entry),
      });

      if (!response.ok) {
        const message = await readApiError(response, "Не удалось синхронизировать отметку обхода");
        throw new Error(
          message === "Помещение не включено в обходы"
            ? "Помещение найдено по QR, но сейчас не включено в обходы. Отметка не синхронизирована."
            : message
        );
      }

      entry.syncStatus = "synced";
      entry.syncError = null;
      entry.syncedAt = new Date().toISOString();
      changed = true;
    } catch (error) {
      entry.syncStatus = "error";
      entry.syncError = error instanceof Error ? error.message : "Sync failed";
      changed = true;
    }
  }

  if (changed) {
    await setQueue([...queue]);
  }

  const hasPending = queue.some((item) => item.syncStatus !== "synced");
  if (!hasPending) {
    await setMeta({ lastSyncedAt: new Date().toISOString() });
  }
}

export async function retryErroredRoundsCheckins() {
  const queue = await getQueue();
  for (const entry of queue) {
    if (entry.syncStatus === "error") {
      entry.syncStatus = "pending";
      entry.syncError = null;
    }
  }
  await setQueue(queue);
}

export async function pruneSyncedRoundsCheckins() {
  const queue = await getQueue();
  const threshold = Date.now() - 1000 * 60 * 60 * 24;
  const next = queue.filter((item) => {
    if (item.syncStatus !== "synced" || !item.syncedAt) return true;
    return new Date(item.syncedAt).getTime() >= threshold;
  });
  if (next.length !== queue.length) {
    await setQueue(next);
  }
}

export async function saveRoundsScannerSnapshot(snapshot: RoundsScannerSnapshot) {
  try {
    await snapshotStorage.setItem("scanner_snapshot", snapshot);
  } catch (error) {
    console.error("Failed to save rounds scanner snapshot to IndexedDB:", error);
  }
}

export async function loadRoundsScannerSnapshot() {
  try {
    return (await snapshotStorage.getItem<RoundsScannerSnapshot>("scanner_snapshot")) ?? null;
  } catch (error) {
    console.error("Failed to load rounds scanner snapshot from IndexedDB:", error);
    return null;
  }
}
