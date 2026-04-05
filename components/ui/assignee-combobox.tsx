"use client";

import { useEffect, useMemo, useRef, useState } from "react";

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
  defaultValue?: string;
  onSelectedIdChange?: (id: string) => void;
};

export function AssigneeCombobox({
  name,
  options,
  placeholder = "Назначить исполнителя",
  required = false,
  defaultValue = "",
  onSelectedIdChange,
}: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const initialOption = options.find((option) => option.id === defaultValue);
  const [query, setQuery] = useState(initialOption ? (initialOption.label ?? initialOption.full_name ?? "") : "");
  const [selectedId, setSelectedId] = useState(defaultValue);
  const containerRef = useRef<HTMLDivElement>(null);

  const filteredOptions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((option) => {
      const label = (option.label ?? option.full_name ?? "").toLowerCase();
      const subtitle = (option.subtitle ?? option.email ?? "").toLowerCase();
      return label.includes(q) || subtitle.includes(q);
    });
  }, [options, query]);

  useEffect(() => {
    if (!isOpen) return;
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  useEffect(() => {
    const option = options.find((item) => item.id === defaultValue);
    setSelectedId(defaultValue);
    setQuery(option ? (option.label ?? option.full_name ?? "") : "");
  }, [defaultValue, options]);

  function selectOption(option: AssigneeOption) {
    setSelectedId(option.id);
    setQuery(option.label ?? option.full_name ?? "");
    setIsOpen(false);
    onSelectedIdChange?.(option.id);
  }

  return (
    <div
      ref={containerRef}
      className="assignee-combobox"
      role="combobox"
      aria-expanded={isOpen}
      aria-haspopup="listbox"
      aria-controls={`${name}-listbox`}
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
                onMouseDown={(event) => event.preventDefault()}
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
