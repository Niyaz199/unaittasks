"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { enqueueAction } from "@/lib/offline/queue";

export function CommentForm({ taskId }: { taskId: string }) {
  const [body, setBody] = useState("");
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const router = useRouter();

  function submit() {
    startTransition(async () => {
      const text = body.trim();
      if (!text) return;
      setMessage(null);

      if (!navigator.onLine) {
        await enqueueAction({
          id: crypto.randomUUID(),
          type: "add_comment",
          taskId,
          body: text,
          clientMsgId: crypto.randomUUID(),
          createdAt: new Date().toISOString()
        });
        setBody("");
        setMessage("Комментарий сохранен в очередь и отправится при восстановлении сети.");
        return;
      }

      const response = await fetch(`/api/tasks/${taskId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: text, clientMsgId: crypto.randomUUID() })
      });

      if (!response.ok) {
        setMessage("Не удалось отправить комментарий");
        return;
      }

      setBody("");
      router.refresh();
    });
  }

  return (
    <div className="grid">
      <textarea
        className="input comment-input"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={4}
        placeholder="Комментарий..."
        disabled={pending}
      />
      <div className="row comment-form-actions">
        <button className="btn btn-accent" type="button" onClick={submit} disabled={pending}>
          Отправить
        </button>
      </div>
      {message ? <div className="text-soft">{message}</div> : null}
    </div>
  );
}
