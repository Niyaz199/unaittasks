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

export function PprDrawer({ open, title, onClose, children, isDirty }: Props) {
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
      className="filters-overlay"
      onClick={handleClose}
      onKeyDown={(event) => {
        if (event.key === "Escape") handleClose();
      }}
      role="presentation"
    >
      <aside 
        className="filters-drawer" 
        onClick={(event) => event.stopPropagation()} 
        role="dialog" 
        aria-modal="true"
        style={{ display: "flex", flexDirection: "column", padding: 0 }}
      >
        <div className="modal-header ppr-modal-header" style={{ padding: "1.25rem" }}>
          <h2 className="modal-title">{title}</h2>
          <button className="btn btn-ghost" type="button" onClick={handleClose}>
            Закрыть
          </button>
        </div>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          {children}
        </div>
      </aside>
    </div>
  );
}
