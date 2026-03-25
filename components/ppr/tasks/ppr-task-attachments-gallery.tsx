"use client";

import { useState } from "react";
import type { PprTaskAttachmentWithUrl } from "@/lib/ppr/queries";

export function PprTaskAttachmentsGallery({ attachments }: { attachments: PprTaskAttachmentWithUrl[] }) {
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

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
