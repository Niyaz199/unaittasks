import { ReactNode } from "react";

interface DirectoryToolbarProps {
  onSearch: (value: string) => void;
  searchPlaceholder?: string;
  children?: ReactNode; // For filters and actions
}

export function DirectoryToolbar({ onSearch, searchPlaceholder = "Search...", children }: DirectoryToolbarProps) {
  return (
    <div className="section-card" style={{ padding: "0.75rem" }}>
      <div className="row" style={{ gap: "0.75rem", alignItems: "center", flexWrap: "wrap" }}>
        <div className="row" style={{ gap: "0.5rem", alignItems: "center", flex: 1, minWidth: "200px" }}>
          <input
            className="input"
            type="text"
            placeholder={searchPlaceholder}
            onChange={(e) => onSearch(e.target.value)}
            style={{ width: "100%", maxWidth: "300px" }}
          />
        </div>

        <div style={{ height: "24px", width: "1px", background: "var(--line)" }} />

        <div className="row" style={{ gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
          {children}
        </div>
      </div>
    </div>
  );
}
