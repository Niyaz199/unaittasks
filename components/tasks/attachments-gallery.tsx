"use client";

import { useState, useEffect, useCallback } from "react";
import type { TaskAttachment } from "@/lib/types";

type AttachmentsGalleryProps = {
  taskId: string;
  commentId?: string | null;
};

type AttachmentWithUrl = TaskAttachment & { url: string | null };

export function AttachmentsGallery({ taskId, commentId = null }: AttachmentsGalleryProps) {
  const [attachments, setAttachments] = useState<AttachmentWithUrl[]>([]);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

  const fetchAttachments = useCallback(async () => {
    const qs = commentId ? `?comment_id=${commentId}` : "";
    try {
      const res = await fetch(`/api/tasks/${taskId}/attachments${qs}`);
      if (!res.ok) return;
      const json = await res.json();
      setAttachments(json.attachments ?? []);
    } catch {
      // нет фото — молча игнорируем
    }
  }, [taskId, commentId]);

  useEffect(() => {
    fetchAttachments();
  }, [fetchAttachments]);

  if (!attachments.length) return null;

  return (
    <>
      <div className="att-gallery">
        {attachments.map((a) =>
          a.url ? (
            <button
              key={a.id}
              type="button"
              className="att-thumb-btn"
              onClick={() => setLightboxSrc(a.url!)}
              aria-label={`Открыть фото ${a.file_name}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={a.url} alt={a.file_name} className="att-thumb-img" loading="lazy" />
            </button>
          ) : (
            <div key={a.id} className="att-thumb-btn att-thumb-broken" aria-label={a.file_name}>
              <span className="att-thumb-broken-icon" aria-hidden="true">🖼️</span>
            </div>
          )
        )}
      </div>

      {lightboxSrc && (
        <div
          className="att-lightbox"
          role="dialog"
          aria-modal="true"
          aria-label="Просмотр фото"
          onClick={() => setLightboxSrc(null)}
        >
          <button
            type="button"
            className="att-lightbox-close"
            onClick={() => setLightboxSrc(null)}
            aria-label="Закрыть"
          >
            ✕
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightboxSrc}
            alt="Просмотр"
            className="att-lightbox-img"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
}
