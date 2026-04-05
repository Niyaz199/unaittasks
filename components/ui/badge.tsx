import type { ComponentPropsWithoutRef, ReactNode } from "react";

type Tone = "neutral" | "info" | "warning" | "success" | "danger" | "violet";

type BadgeProps = ComponentPropsWithoutRef<"span"> & {
  children: ReactNode;
  tone?: Tone;
};

export function Badge({ children, tone = "neutral", className, ...props }: BadgeProps) {
  const badgeClassName = `badge badge-${tone}${className ? ` ${className}` : ""}`;
  return (
    <span className={badgeClassName} {...props}>
      {children}
    </span>
  );
}
