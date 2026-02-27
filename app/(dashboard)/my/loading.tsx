export default function MyTasksLoading() {
  return (
    <section className="tl-page">
      <div className="tl-skeleton-kpi">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="tl-skeleton-kpi-card tl-skeleton-pulse" />
        ))}
      </div>
      <div className="tl-skeleton-search tl-skeleton-pulse" />
      <div className="tl-skeleton-chips">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="tl-skeleton-chip tl-skeleton-pulse" />
        ))}
      </div>
      <div className="tl-list">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="tl-skeleton-card tl-skeleton-pulse" />
        ))}
      </div>
    </section>
  );
}
