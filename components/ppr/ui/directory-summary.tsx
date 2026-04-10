import { ReactNode } from "react";

interface SummaryMetric {
  label: string;
  value: string | number;
  tone?: "neutral" | "info" | "success" | "warning" | "danger" | "violet";
  icon?: ReactNode;
  onClick?: () => void;
  isActive?: boolean;
}

interface DirectorySummaryProps {
  metrics: SummaryMetric[];
}

export function DirectorySummary({ metrics }: DirectorySummaryProps) {
  return (
    <div className="directory-summary-grid">
      {metrics.map((metric, index) => {
        const isClickable = !!metric.onClick;
        return (
          <div
            key={index}
            className={`section-card directory-summary-card${isClickable ? " is-clickable" : ""}${metric.isActive ? " is-active" : ""}`}
            data-tone={metric.tone ?? "neutral"}
            onClick={metric.onClick}
          >
            <div className="directory-summary-card-inner">
              <span className="directory-summary-label">{metric.label}</span>
              <div className="directory-summary-value-row">
                <span className="directory-summary-value">{metric.value}</span>
                {metric.icon}
              </div>
              <div className="directory-summary-accent" />
            </div>
          </div>
        );
      })}
    </div>
  );
}
