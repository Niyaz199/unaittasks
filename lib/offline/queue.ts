"use client";

import localforage from "localforage";

type PendingAction =
  | {
      id: string;
      type: "update_status";
      taskId: string;
      status: "new" | "in_progress" | "paused" | "done";
      createdAt: string;
    }
  | {
      id: string;
      type: "add_comment";
      taskId: string;
      body: string;
      clientMsgId: string;
      createdAt: string;
    };

const storage = localforage.createInstance({
  name: "ops-tasker",
  storeName: "pending_actions"
});

async function getQueue(): Promise<PendingAction[]> {
  return (await storage.getItem<PendingAction[]>("queue")) ?? [];
}

async function setQueue(queue: PendingAction[]) {
  await storage.setItem("queue", queue);
}

export async function enqueueAction(action: PendingAction) {
  const queue = await getQueue();
  queue.push(action);
  await setQueue(queue);
}

async function runAction(action: PendingAction) {
  if (action.type === "update_status") {
    const response = await fetch(`/api/tasks/${action.taskId}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: action.status })
    });
    if (!response.ok) throw new Error("Status sync failed");
    return;
  }

  const response = await fetch(`/api/tasks/${action.taskId}/comments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      body: action.body,
      clientMsgId: action.clientMsgId
    })
  });
  if (!response.ok) throw new Error("Comment sync failed");
}

export async function flushQueue() {
  if (!navigator.onLine) return;
  const queue = await getQueue();
  if (!queue.length) return;

  const remaining: PendingAction[] = [];
  for (const action of queue) {
    try {
      await runAction(action);
    } catch {
      remaining.push(action);
    }
  }

  await setQueue(remaining);
}
