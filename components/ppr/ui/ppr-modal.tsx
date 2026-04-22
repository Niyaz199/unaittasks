"use client";

import type { ReactNode } from "react";
import React from "react";

type Props = {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  isDirty?: boolean;
};

export function PprModal({ open, title, onClose, children, isDirty }: Props) {
  if (!open) return null;

  function handleClose() {
    if (isDirty) {
      if (!window.confirm("Есть несохранённые изменения. Закрыть без сохранения?")) {
        return;
      }
    }
    onClose();
  }

  return (
    <div
      className="modal-overlay"
      onKeyDown={(event) => {
        if (event.key === "Escape") handleClose();
      }}
      role="presentation"
    >
      <div 
        className="modal-content ppr-modal-content" 
        onClick={(event) => event.stopPropagation()} 
        role="dialog" 
        aria-modal="true"
      >
        <div className="modal-header ppr-modal-header">
          <h2 className="modal-title">{title}</h2>
          <button className="btn btn-ghost" type="button" onClick={handleClose}>
            Закрыть
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function PprFormGroup({ label, children, description, hint }: { label: string; children: ReactNode; description?: ReactNode; hint?: string }) {
  return (
    <div className="ctf-field">
      <span className="ctf-label">
        {label}
        {description && <span className="ctf-optional" style={{ textTransform: "none" }}> — {description}</span>}
      </span>
      {children}
      {hint && <p className="text-soft" style={{ fontSize: "0.72rem", margin: 0, lineHeight: 1.45, opacity: 0.75 }}>{hint}</p>}
    </div>
  );
}

export function PprFormSection({ title, desc, children }: { title?: string; desc?: string; children: ReactNode }) {
  return (
    <div className="ctf-section" style={{ marginTop: "0.5rem", marginBottom: "1rem" }}>
      {(title || desc) && (
        <div style={{ display: "grid", gap: "0.2rem" }}>
          {title && <h3 className="ctf-section-title">{title}</h3>}
          {desc && <p className="text-soft" style={{ fontSize: "0.8rem", margin: 0 }}>{desc}</p>}
        </div>
      )}
      <div style={{ display: "grid", gap: "1rem" }}>
        {children}
      </div>
    </div>
  );
}
