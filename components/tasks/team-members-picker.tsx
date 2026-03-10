"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { AssigneeOption } from "@/components/ui/assignee-combobox";

type Props = {
  options: AssigneeOption[];
  selectedIds: string[];
  onAdd: (id: string) => void;
  onRemove: (id: string) => void;
  placeholder?: string;
  disabled?: boolean;
  excludedIds?: string[];
  quickActions?: Array<{ id: string; label: string }>;
};

export function TeamMembersPicker({
  options,
  selectedIds,
  onAdd,
  onRemove,
  placeholder = "Добавить участника",
  disabled = false,
  excludedIds = [],
  quickActions = []
}: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  const optionsMap = useMemo(() => {
    return new Map(options.map((option) => [option.id, option]));
  }, [options]);

  const selectedChips = useMemo(() => {
    return selectedIds
      .map((id) => {
        const option = optionsMap.get(id);
        if (!option) return null;
        return { id, label: option.label ?? option.full_name ?? id };
      })
      .filter(Boolean) as Array<{ id: string; label: string }>;
  }, [selectedIds, optionsMap]);

  const filteredOptions = useMemo(() => {
    const excluded = new Set([...selectedIds, ...excludedIds]);
    const q = query.trim().toLowerCase();
    return options.filter((option) => {
      if (excluded.has(option.id)) return false;
      const label = (option.label ?? option.full_name ?? "").toLowerCase();
      const subtitle = (option.subtitle ?? option.email ?? "").toLowerCase();
      if (!q) return true;
      return label.includes(q) || subtitle.includes(q);
    });
  }, [options, query, selectedIds, excludedIds]);

  // Закрываем dropdown кликом вне контейнера — безопасно и без гонок
  useEffect(() => {
    if (!isOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  function addFromOption(option: AssigneeOption) {
    if (disabled) return;
    if (selectedIds.includes(option.id)) return;
    onAdd(option.id);
    setQuery("");
    setIsOpen(false);
  }

  return (
    <div className="team-picker">
      <div className="team-picker-chips">
        {selectedChips.length ? (
          selectedChips.map((chip) => (
            <span key={chip.id} className="team-picker-chip">
              <span>{chip.label}</span>
              {!disabled ? (
                <button type="button" className="team-picker-chip-remove" onClick={() => onRemove(chip.id)}>
                  ×
                </button>
              ) : null}
            </span>
          ))
        ) : (
          <span className="text-soft">Команда: —</span>
        )}
      </div>

      {!disabled ? (
        <>
          {quickActions.length ? (
            <div className="team-quick-actions">
              {quickActions.map((action) => (
                <button
                  key={`${action.id}-${action.label}`}
                  type="button"
                  className="btn btn-ghost team-quick-btn"
                  disabled={selectedIds.includes(action.id)}
                  onClick={() => {
                    if (selectedIds.includes(action.id)) return;
                    onAdd(action.id);
                  }}
                >
                  {action.label}
                </button>
              ))}
            </div>
          ) : null}

          <div
            ref={containerRef}
            className="assignee-combobox"
            role="combobox"
            aria-expanded={isOpen}
            aria-haspopup="listbox"
            aria-controls="team-members-listbox"
          >
            <input
              className="input team-search-input"
              value={query}
              placeholder={placeholder}
              onFocus={() => setIsOpen(true)}
              onClick={() => setIsOpen(true)}
              onChange={(event) => {
                setQuery(event.target.value);
                setIsOpen(true);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" && filteredOptions.length) {
                  event.preventDefault();
                  addFromOption(filteredOptions[0]);
                }
              }}
              autoComplete="off"
            />
            {isOpen ? (
              <div className="assignee-combobox-list" role="listbox" id="team-members-listbox">
                {filteredOptions.length ? (
                  filteredOptions.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      className="assignee-combobox-item"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => addFromOption(option)}
                    >
                      <span>{option.label ?? option.full_name ?? "—"}</span>
                      {option.subtitle ?? option.email ? (
                        <span className="text-soft">{option.subtitle ?? option.email}</span>
                      ) : null}
                    </button>
                  ))
                ) : (
                  <div className="assignee-combobox-empty text-soft">Ничего не найдено</div>
                )}
              </div>
            ) : null}
          </div>
        </>
      ) : null}
    </div>
  );
}
