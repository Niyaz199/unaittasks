"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PhotoPicker, type PickedFile } from "@/components/tasks/photo-picker";

export function PprTaskCommentForm({ taskId }: { taskId: string }) {
  const [body, setBody] = useState("");
  const [photoFiles, setPhotoFiles] = useState<PickedFile[]>([]);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  const router = useRouter();

  function setError(msg: string) {
    setMessage(msg);
    setIsError(true);
  }

  function setInfo(msg: string) {
    setMessage(msg);
    setIsError(false);
  }

  function clearMessage() {
    setMessage(null);
    setIsError(false);
  }

  function submit() {
    const text = body.trim();
    if (!text) {
      setError("Введите комментарий.");
      return;
    }

    clearMessage();

    startTransition(async () => {
      try {
        const commentResponse = await fetch(`/api/ppr/tasks/${taskId}/comments`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ body: text }),
        });

        if (!commentResponse.ok) {
          const payload = (await commentResponse.json().catch(() => ({}))) as { error?: string };
          setError(payload.error ?? "Не удалось отправить комментарий");
          return;
        }

        const { commentId } = (await commentResponse.json().catch(() => ({ commentId: null }))) as {
          commentId?: string | null;
        };

        if (photoFiles.length && commentId) {
          const fd = new FormData();
          fd.append("comment_id", commentId);
          photoFiles.forEach((item) => fd.append("files", item.file));
          const attachmentResponse = await fetch(`/api/ppr/tasks/${taskId}/attachments`, {
            method: "POST",
            body: fd,
          });

          if (!attachmentResponse.ok) {
            const payload = (await attachmentResponse.json().catch(() => ({}))) as { error?: string };
            setInfo(payload.error ?? "Комментарий сохранён, но фото не загрузились.");
          } else {
            const payload = (await attachmentResponse.json().catch(() => ({ errors: [] }))) as { errors?: string[] };
            if (payload.errors?.length) {
              setInfo(`Комментарий сохранён. Часть фото не загрузилась: ${payload.errors.join("; ")}`);
            }
          }
        }

        setBody("");
        setPhotoFiles([]);
        router.refresh();
      } catch (error) {
        setError(error instanceof Error ? error.message : "Не удалось отправить комментарий");
      }
    });
  }

  return (
    <div className="cf-wrap" style={{ padding: "0.5rem", background: "color-mix(in srgb, var(--panel-soft) 20%, transparent)", borderRadius: "12px", border: "1px solid color-mix(in srgb, var(--line-strong) 30%, transparent)" }}>
      <textarea
        className="input comment-input cf-textarea"
        style={{ border: "none", background: "transparent", minHeight: "80px", fontSize: "1rem" }}
        value={body}
        onChange={(event) => {
          setBody(event.target.value);
          if (isError) clearMessage();
        }}
        rows={3}
        placeholder="Написать комментарий по ППР…"
        disabled={pending}
      />
      <div className="cf-footer" style={{ borderTop: "1px solid color-mix(in srgb, var(--line-strong) 20%, transparent)", paddingTop: "0.5rem", marginTop: "0.25rem" }}>
        <PhotoPicker
          files={photoFiles}
          onChange={(files) => {
            setPhotoFiles(files);
            if (isError) clearMessage();
          }}
          disabled={pending}
          label="Фото"
        />
        <button
          className={`btn btn-accent${body.trim().length ? "" : " disabled"}`}
          style={{ height: "36px", padding: "0 1.25rem" }}
          type="button"
          onClick={submit}
          disabled={pending || !body.trim().length}
        >
          {pending ? "..." : "Отправить"}
        </button>
      </div>
      {message ? (
        <div className={isError ? "comment-form-error" : "text-soft"} style={{ padding: "0.5rem", fontSize: "0.9rem" }}>
          {message}
        </div>
      ) : null}
    </div>
  );
}
