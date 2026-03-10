"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { enqueueAction } from "@/lib/offline/queue";
import { PhotoPicker, type PickedFile } from "@/components/tasks/photo-picker";

export function CommentForm({ taskId }: { taskId: string }) {
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
    const hasPhotos = photoFiles.length > 0;

    if (!text && !hasPhotos) {
      setError("Напишите комментарий или прикрепите фото.");
      return;
    }

    clearMessage();

    startTransition(async () => {
      if (!navigator.onLine) {
        if (text) {
          await enqueueAction({
            id: crypto.randomUUID(),
            type: "add_comment",
            taskId,
            body: text,
            clientMsgId: crypto.randomUUID(),
            createdAt: new Date().toISOString()
          });
        }
        setBody("");
        setPhotoFiles([]);
        setInfo(
          hasPhotos && !text
            ? "Фото будут доступны только после подключения к сети — они не сохранены в очередь."
            : "Комментарий сохранен в очередь и отправится при восстановлении сети."
        );
        return;
      }

      const response = await fetch(`/api/tasks/${taskId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: text, clientMsgId: crypto.randomUUID() })
      });

      if (!response.ok) {
        setError("Не удалось отправить комментарий");
        return;
      }

      const { commentId } = await response.json().catch(() => ({ commentId: null })) as { commentId?: string | null };

      // Загружаем фото к комментарию, если есть и если получили commentId
      if (hasPhotos && commentId) {
        const fd = new FormData();
        fd.append("comment_id", commentId);
        photoFiles.forEach((pf) => fd.append("files", pf.file));
        try {
          const uploadRes = await fetch(`/api/tasks/${taskId}/attachments`, {
            method: "POST",
            body: fd
          });
          if (uploadRes.ok) {
            const uploadJson = await uploadRes.json();
            if (uploadJson.errors?.length) {
              setInfo(`Комментарий отправлен. Часть фото не загрузилась: ${uploadJson.errors.join("; ")}`);
            }
          } else {
            setInfo("Комментарий отправлен, но фото не удалось загрузить.");
          }
        } catch {
          setInfo("Комментарий отправлен, но фото не удалось загрузить.");
        }
      }

      setBody("");
      setPhotoFiles([]);
      router.refresh();
    });
  }

  const canSubmit = body.trim().length > 0 || photoFiles.length > 0;

  return (
    <div className="cf-wrap">
      <textarea
        className="input comment-input cf-textarea"
        value={body}
        onChange={(e) => {
          setBody(e.target.value);
          if (isError) clearMessage();
        }}
        rows={3}
        placeholder="Написать комментарий…"
        disabled={pending}
      />
      <div className="cf-footer">
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
          className={`btn cf-send-btn${canSubmit ? " cf-send-btn--active" : ""}`}
          type="button"
          onClick={submit}
          disabled={pending || !canSubmit}
          aria-label="Отправить комментарий"
        >
          {pending ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="cf-send-spinner"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
          )}
          <span className="cf-send-label">Отправить</span>
        </button>
      </div>
      {message ? (
        <div className={isError ? "comment-form-error" : "text-soft"} role={isError ? "alert" : "status"}>
          {message}
        </div>
      ) : null}
    </div>
  );
}
