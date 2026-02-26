import Link from "next/link";

type Props = {
  message: string;
  hint?: string;
  actionLabel?: string;
  actionHref?: string;
};

export function EmptyState({ message, hint, actionLabel, actionHref }: Props) {
  return (
    <div className="empty-state">
      <div className="empty-state-icon">◎</div>
      <p className="empty-state-title">{message}</p>
      {hint ? <p className="empty-state-hint">{hint}</p> : null}
      {actionLabel && actionHref ? (
        <div className="row" style={{ marginTop: "0.75rem" }}>
          <Link className="btn btn-accent" href={actionHref}>
            {actionLabel}
          </Link>
        </div>
      ) : null}
    </div>
  );
}
