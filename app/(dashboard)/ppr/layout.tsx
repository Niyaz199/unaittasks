import type { ReactNode } from "react";

export default function PprLayout({ children }: { children: ReactNode }) {
  return <div className="ppr-module-layout">{children}</div>;
}
