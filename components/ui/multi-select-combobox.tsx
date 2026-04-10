"use client";

import { useEffect, useMemo, useRef, useState } from "react";

export type MultiSelectOption = {
  id: string;
  label: string;
  subtitle?: string | null;
  is_active?: boolean;
};

type Props = {
  name: string;
  options: MultiSelectOption[];
  placeholder?: string;
  defaultValues?: string[];
  onChange?: (selectedIds: string[]) => void;
};

export function MultiSelectCombobox({
  name,
  options,
  placeholder = "Выберите значения",
  defaultValues = [],
  onChange,
}: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>(defaultValues);
  const containerRef = useRef<HTMLDivElement>(null);

  const filteredOptions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((option) => {
      const label = option.label.toLowerCase();
      const subtitle = (option.subtitle ?? "").toLowerCase();
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

  function toggleOption(optionId: string) {
    const newSelectedIds = selectedIds.includes(optionId)
      ? selectedIds.filter((id) => id !== optionId)
      : [...selectedIds, optionId];
    
    setSelectedIds(newSelectedIds);
    onChange?.(newSelectedIds);
    setQuery("");
  }

  function removeOption(optionId: string, event: React.MouseEvent) {
    event.stopPropagation();
    const newSelectedIds = selectedIds.filter((id) => id !== optionId);
    setSelectedIds(newSelectedIds);
    onChange?.(newSelectedIds);
  }

  const selectedOptions = useMemo(() => {
    return selectedIds
      .map((id) => options.find((opt) => opt.id === id))
      .filter((opt): opt is MultiSelectOption => opt !== undefined);
  }, [selectedIds, options]);

  return (
    <div
      ref={containerRef}
      className="assignee-combobox"
      role="combobox"
      aria-expanded={isOpen}
      aria-haspopup="listbox"
    >
      {/* Hidden inputs for form submission */}
      {selectedIds.map((id) => (
        <input key={id} type="hidden" name={name} value={id} />
      ))}

      <div 
        className="input" 
        style={{ 
          display: "flex", 
          flexWrap: "wrap", 
          gap: "0.4rem", 
          padding: "0.4rem 0.6rem",
          minHeight: "44px",
          alignItems: "center"
        }}
        onClick={() => setIsOpen(true)}
      >
        {selectedOptions.map((option) => (
          <span 
            key={option.id}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.3rem",
              background: "color-mix(in srgb, var(--brand-grad-start) 20%, transparent)",
              color: "#eff6ff",
              padding: "0.2rem 0.5rem",
              borderRadius: "6px",
              fontSize: "0.85rem",
              border: "1px solid color-mix(in srgb, var(--brand-grad-start) 40%, transparent)"
            }}
          >
            {option.label}
            <button
              type="button"
              onClick={(e) => removeOption(option.id, e)}
              style={{
                background: "transparent",
                border: "none",
                color: "inherit",
                cursor: "pointer",
                padding: "0 0.2rem",
                display: "flex",
                alignItems: "center",
                opacity: 0.7,
              }}
            >
              ×
            </button>
          </span>
        ))}
        
        <input
          value={query}
          placeholder={selectedIds.length === 0 ? placeholder : ""}
          onFocus={() => setIsOpen(true)}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && isOpen && filteredOptions.length) {
              event.preventDefault();
              toggleOption(filteredOptions[0].id);
            } else if (event.key === "Backspace" && query === "" && selectedIds.length > 0) {
              const newSelectedIds = [...selectedIds];
              newSelectedIds.pop();
              setSelectedIds(newSelectedIds);
              onChange?.(newSelectedIds);
            }
          }}
          style={{
            flex: 1,
            minWidth: "120px",
            border: "none",
            background: "transparent",
            color: "var(--text)",
            outline: "none",
            fontSize: "0.92rem",
            padding: "0.1rem 0"
          }}
          autoComplete="off"
        />
      </div>

      {isOpen ? (
        <div className="assignee-combobox-list" role="listbox" style={{ maxHeight: "220px" }}>
          {filteredOptions.length ? (
            filteredOptions.map((option) => {
              const isSelected = selectedIds.includes(option.id);
              return (
                <button
                  key={option.id}
                  type="button"
                  className="assignee-combobox-item"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                    background: isSelected ? "color-mix(in srgb, var(--panel-soft) 80%, transparent)" : "transparent"
                  }}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => toggleOption(option.id)}
                >
                  <div style={{ 
                    width: "16px", 
                    height: "16px", 
                    border: "1px solid var(--line-strong)", 
                    borderRadius: "4px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: isSelected ? "var(--accent)" : "transparent",
                    borderColor: isSelected ? "var(--accent)" : "var(--line-strong)"
                  }}>
                    {isSelected && (
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12"></polyline>
                      </svg>
                    )}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
                    <span>
                      {option.label}
                      {option.is_active === false ? <span className="text-soft" style={{ fontSize: "0.8rem" }}> [неактивна]</span> : null}
                    </span>
                    {option.subtitle ? (
                      <span className="text-soft" style={{ fontSize: "0.8rem" }}>{option.subtitle}</span>
                    ) : null}
                  </div>
                </button>
              );
            })
          ) : (
            <div className="assignee-combobox-empty text-soft">Ничего не найдено</div>
          )}
        </div>
      ) : null}
    </div>
  );
}
