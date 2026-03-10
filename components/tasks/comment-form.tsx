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
    <div className="grid">
      <textarea
        className="input comment-input"
        value={body}
        onChange={(e) => {
          setBody(e.target.value);
          if (isError) clearMessage();
        }}
        rows={4}
        placeholder="Комментарий..."
        disabled={pending}
      />
      <PhotoPicker
        files={photoFiles}
        onChange={(files) => {
          setPhotoFiles(files);
          if (isError) clearMessage();
        }}
        disabled={pending}
        label="Прикрепить фото к комментарию"
      />
      <div className="row comment-form-actions">
        <button
          className="btn btn-ghost comment-submit-btn"
          type="button"
          onClick={submit}
          disabled={pending || !canSubmit}
        >
          Отправить
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
