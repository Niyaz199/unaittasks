import { ReactNode } from "react";
import { DirectorySummary } from "@/components/ppr/ui/directory-summary";
import { DirectoryToolbar } from "@/components/ppr/ui/directory-toolbar";
import { EmptyState } from "@/components/ui/empty-state";
import type { Route } from "next";

interface SummaryMetric {
  label: string;
  value: string | number;
  tone?: "neutral" | "info" | "success" | "warning" | "danger" | "violet";
  icon?: ReactNode;
  onClick?: () => void;
  isActive?: boolean;
}

export interface PprPageShellProps {
  metrics?: SummaryMetric[];
  
  onSearch?: (value: string) => void;
  searchPlaceholder?: string;
  filters?: ReactNode;
  actions?: ReactNode;
  toolbarClassName?: string;
  toolbarBodyClassName?: string;
  
  isEmpty: boolean;
  emptyState: {
    message: string;
    hint?: string;
    actionLabel?: string;
    actionHref?: Route;
  };
  
  isFilteredEmpty?: boolean;
  filteredEmptyState?: {
    message?: string;
    hint?: string;
  };

  children: ReactNode;
}

export function PprPageShell({
  metrics,
  onSearch,
  searchPlaceholder,
  filters,
  actions,
  toolbarClassName,
  toolbarBodyClassName,
  isEmpty,
  emptyState,
  isFilteredEmpty,
  filteredEmptyState,
  children,
}: PprPageShellProps) {
  return (
    <div className="grid" style={{ gap: "1.5rem" }}>
      {metrics && metrics.length > 0 && (
        <DirectorySummary metrics={metrics} />
      )}

      {(onSearch || filters || actions) && (
        <DirectoryToolbar
          onSearch={onSearch}
          searchPlaceholder={searchPlaceholder}
          actions={actions}
          className={toolbarClassName}
          bodyClassName={toolbarBodyClassName}
        >
          {filters}
        </DirectoryToolbar>
      )}

      {isEmpty ? (
        <EmptyState
          message={emptyState.message}
          hint={emptyState.hint}
          actionLabel={emptyState.actionLabel}
          actionHref={emptyState.actionHref}
        />
      ) : isFilteredEmpty ? (
        <EmptyState 
          message={filteredEmptyState?.message || "Ничего не найдено"} 
          hint={filteredEmptyState?.hint || "Попробуйте изменить параметры фильтрации."} 
        />
      ) : (
        children
      )}
    </div>
  );
}
