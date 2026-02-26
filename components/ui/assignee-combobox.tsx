"use client";

import { useMemo, useState } from "react";

export type AssigneeOption = {
  id: string;
  full_name?: string;
  email?: string | null;
  label?: string;
  subtitle?: string | null;
};

type Props = {
  name: string;
  options: AssigneeOption[];
  placeholder?: string;
  required?: boolean;
  onSelectedIdChange?: (id: string) => void;
};

export function AssigneeCombobox({
  name,
  options,
  placeholder = "Назначить исполнителя",
  required = false,
  onSelectedIdChange
}: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState("");

  const filteredOptions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((option) => {
      const label = (option.label ?? option.full_name ?? "").toLowerCase();
      const subtitle = (option.subtitle ?? option.email ?? "").toLowerCase();
      return label.includes(q) || subtitle.includes(q);
    });
  }, [options, query]);

  function selectOption(option: AssigneeOption) {
    setSelectedId(option.id);
    setQuery(option.label ?? option.full_name ?? "");
    setIsOpen(false);
    onSelectedIdChange?.(option.id);
  }

  return (
    <div
      className="assignee-combobox"
      role="combobox"
      aria-expanded={isOpen}
      aria-haspopup="listbox"
      aria-controls={`${name}-listbox`}
      onBlur={() => {
        setTimeout(() => setIsOpen(false), 120);
      }}
    >
      <input type="hidden" name={name} value={selectedId} />
      <input
        className="input"
        value={query}
        placeholder={placeholder}
        onFocus={() => setIsOpen(true)}
        onClick={() => setIsOpen(true)}
        onChange={(event) => {
          setQuery(event.target.value);
          if (selectedId) {
            setSelectedId("");
            onSelectedIdChange?.("");
          }
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter" && isOpen && filteredOptions.length) {
            event.preventDefault();
            selectOption(filteredOptions[0]);
          }
        }}
        autoComplete="off"
      />

      {isOpen ? (
        <div className="assignee-combobox-list" role="listbox" id={`${name}-listbox`}>
          {filteredOptions.length ? (
            filteredOptions.map((option) => (
              <button
                key={option.id}
                type="button"
                className="assignee-combobox-item"
                onClick={() => selectOption(option)}
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

      {required && !selectedId && query.trim() ? (
        <div className="text-soft assignee-combobox-hint">Выберите пользователя из списка</div>
      ) : null}
    </div>
  );
}
