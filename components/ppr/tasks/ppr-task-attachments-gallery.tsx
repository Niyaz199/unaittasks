"use client";

import { useCallback, useEffect, useState } from "react";
import type { PprTaskAttachment } from "@/lib/ppr/types";

type AttachmentWithUrl = PprTaskAttachment & { url: string | null };

export function PprTaskAttachmentsGallery({ taskId, commentId = null }: { taskId: string; commentId?: string | null }) {
  const [attachments, setAttachments] = useState<AttachmentWithUrl[]>([]);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

  const fetchAttachments = useCallback(async () => {
    const qs = commentId ? `?comment_id=${commentId}` : "";
    try {
      const response = await fetch(`/api/ppr/tasks/${taskId}/attachments${qs}`);
      if (!response.ok) return;
      const json = await response.json();
      setAttachments(json.attachments ?? []);
    } catch {
      // ignore
    }
  }, [taskId, commentId]);

  useEffect(() => {
    fetchAttachments();
  }, [fetchAttachments]);

  if (!attachments.length) return null;

  return (
    <>
      <div className="att-gallery">
        {attachments.map((attachment) =>
          attachment.url ? (
            <button
              key={attachment.id}
              type="button"
              className="att-thumb-btn"
              onClick={() => setLightboxSrc(attachment.url)}
              aria-label={`Открыть фото ${attachment.file_name}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={attachment.url} alt={attachment.file_name} className="att-thumb-img" loading="lazy" />
            </button>
          ) : (
            <div key={attachment.id} className="att-thumb-btn att-thumb-broken" aria-label={attachment.file_name}>
              <span className="att-thumb-broken-icon" aria-hidden="true">🖼️</span>
            </div>
          )
        )}
      </div>

      {lightboxSrc ? (
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
            onClick={(event) => event.stopPropagation()}
          />
        </div>
      ) : null}
    </>
  );
}
