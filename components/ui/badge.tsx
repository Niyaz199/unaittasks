import type { ReactNode } from "react";

type Tone = "neutral" | "info" | "warning" | "success" | "danger" | "violet";

export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: Tone }) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}
