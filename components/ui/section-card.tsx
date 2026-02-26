import type { ReactNode } from "react";

export function SectionCard({ children }: { children: ReactNode }) {
  return <section className="section-card">{children}</section>;
}
