import Link from "next/link";
import type { Route } from "next";
import type { ReactNode } from "react";

type Action = {
  label: string;
  href: Route | string;
};

type Props = {
  /** Заголовок (что не настроено / что отсутствует). */
  title: string;
  /** Поясняющий текст одним абзацем. */
  description?: string;
  /** Главное действие — ссылка на форму создания зависимости. */
  primary?: Action;
  /** Дополнительное действие (опц.) — например, на справку или альтернативный путь. */
  secondary?: Action;
  /** Иконка/эмодзи слева (опц.). */
  icon?: ReactNode;
  /** Тон оформления. По умолчанию info. */
  tone?: "info" | "warning";
  /** Если у пользователя нет прав на создание — скрываем кнопку, оставляем только текст. */
  disabled?: boolean;
  /** Текст-замена для disabled — кому обращаться. */
  disabledHint?: string;
};

/**
 * Универсальная "тупиковая" заглушка с действием.
 * Используется в местах, где сценарий заблокирован отсутствием зависимой сущности
 * (нет систем / помещений / складов / типов) — даём прямой путь к решению.
 */
export function EmptyStateAction({
  title,
  description,
  primary,
  secondary,
  icon,
  tone = "info",
  disabled = false,
  disabledHint,
}: Props) {
  const accentColor = tone === "warning" ? "var(--warning, #f59e0b)" : "var(--info, #3b82f6)";

  return (
    <div
      className="grid"
      role="status"
      style={{
        gap: "0.75rem",
        padding: "1rem 1.1rem",
        borderRadius: "10px",
        border: `1px solid color-mix(in srgb, ${accentColor} 30%, transparent)`,
        background: `color-mix(in srgb, ${accentColor} 8%, transparent)`,
      }}
    >
      <div className="row" style={{ gap: "0.75rem", alignItems: "flex-start" }}>
        {icon ? (
          <div
            aria-hidden="true"
            style={{
              flexShrink: 0,
              width: "32px",
              height: "32px",
              borderRadius: "8px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: `color-mix(in srgb, ${accentColor} 18%, transparent)`,
              color: accentColor,
              fontSize: "1.05rem",
            }}
          >
            {icon}
          </div>
        ) : null}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: "0.95rem", lineHeight: 1.3 }}>{title}</div>
          {description ? (
            <p
              className="text-soft"
              style={{ margin: "0.2rem 0 0", fontSize: "0.85rem", lineHeight: 1.45 }}
            >
              {description}
            </p>
          ) : null}
        </div>
      </div>

      {disabled ? (
        disabledHint ? (
          <div className="text-soft" style={{ fontSize: "0.82rem" }}>{disabledHint}</div>
        ) : null
      ) : (
        <div className="row" style={{ gap: "0.5rem", flexWrap: "wrap" }}>
          {primary ? (
            <Link
              href={primary.href as Route}
              className="btn btn-accent"
              style={{ minHeight: "36px", padding: "0.4rem 0.9rem", fontSize: "0.88rem" }}
            >
              {primary.label} →
            </Link>
          ) : null}
          {secondary ? (
            <Link
              href={secondary.href as Route}
              className="btn btn-ghost"
              style={{ minHeight: "36px", padding: "0.4rem 0.9rem", fontSize: "0.88rem" }}
            >
              {secondary.label}
            </Link>
          ) : null}
        </div>
      )}
    </div>
  );
}
