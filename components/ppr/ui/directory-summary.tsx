import { ReactNode } from "react";

interface SummaryMetric {
  label: string;
  value: string | number;
  tone?: "neutral" | "info" | "success" | "warning" | "danger" | "violet";
  icon?: ReactNode;
}

interface DirectorySummaryProps {
  metrics: SummaryMetric[];
}

export function DirectorySummary({ metrics }: DirectorySummaryProps) {
  return (
    <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1rem" }}>
      {metrics.map((metric, index) => (
        <div key={index} className="section-card" style={{ padding: "1rem" }}>
          <div className="grid" style={{ gap: "0.25rem" }}>
            <span className="text-soft" style={{ fontSize: "0.85rem" }}>
              {metric.label}
            </span>
            <div className="row" style={{ alignItems: "center", gap: "0.5rem" }}>
              <span style={{ fontSize: "1.5rem", fontWeight: 600 }}>
                {metric.value}
              </span>
              {metric.icon}
            </div>
            {metric.tone && (
              <div
                style={{
                  height: "4px",
                  width: "100%",
                  borderRadius: "2px",
                  background: `var(--${metric.tone})`,
                  marginTop: "0.5rem",
                  opacity: 0.6,
                }}
              />
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
