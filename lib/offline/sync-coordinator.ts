"use client";

import { flushQueue } from "@/lib/offline/queue";
import { flushRoundsQueue, pruneSyncedRoundsCheckins, retryErroredRoundsCheckins } from "@/lib/offline/rounds-queue";

let inFlightSync: Promise<void> | null = null;
let rerunRequested = false;

async function performOfflineSyncCycle() {
  do {
    rerunRequested = false;
    await pruneSyncedRoundsCheckins();
    await retryErroredRoundsCheckins();
    await flushQueue();
    await flushRoundsQueue();
  } while (rerunRequested);
}

export async function runOfflineSync() {
  if (typeof navigator === "undefined" || !navigator.onLine) {
    return;
  }

  if (inFlightSync) {
    rerunRequested = true;
    await inFlightSync;
    return;
  }

  inFlightSync = performOfflineSyncCycle();
  try {
    await inFlightSync;
  } finally {
    inFlightSync = null;
  }
}
