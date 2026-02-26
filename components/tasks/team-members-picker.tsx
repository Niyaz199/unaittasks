"use client";

import { useMemo, useState } from "react";
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
            <div className="row" style={{ flexWrap: "wrap" }}>
              {quickActions.map((action) => (
                <button
                  key={`${action.id}-${action.label}`}
                  type="button"
                  className="btn btn-ghost"
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
            className="assignee-combobox"
            role="combobox"
            aria-expanded={isOpen}
            aria-haspopup="listbox"
            aria-controls="team-members-listbox"
            onBlur={() => setTimeout(() => setIsOpen(false), 120)}
          >
            <input
              className="input"
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
