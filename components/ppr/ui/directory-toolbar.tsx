import { ReactNode } from "react";

interface DirectoryToolbarProps {
  onSearch?: (value: string) => void;
  searchPlaceholder?: string;
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
  bodyClassName?: string;
}

export function DirectoryToolbar({
  onSearch,
  searchPlaceholder = "Поиск...",
  actions,
  children,
  className = "",
  bodyClassName = "",
}: DirectoryToolbarProps) {
  return (
    <div className={`section-card directory-toolbar-shell${className ? ` ${className}` : ""}`}>
      <div className="directory-toolbar-layout">
        <div className="directory-toolbar-head">
          {onSearch && (
            <label className="directory-toolbar-search" aria-label={searchPlaceholder}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                type="text"
                placeholder={searchPlaceholder}
                aria-label={searchPlaceholder}
                onChange={(e) => onSearch(e.target.value)}
                className="directory-toolbar-search-input"
              />
            </label>
          )}
          {actions ? <div className="directory-toolbar-actions">{actions}</div> : null}
        </div>

        {children && (
          <div className={`directory-toolbar-body${bodyClassName ? ` ${bodyClassName}` : ""}`}>
            {children}
          </div>
        )}
      </div>
    </div>
  );
}
