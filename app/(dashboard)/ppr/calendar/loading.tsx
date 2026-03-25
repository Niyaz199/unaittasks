export default function PprCalendarLoading() {
  return (
    <section className="grid">
      <div className="section-card tl-skeleton-pulse" style={{ height: "92px" }} />
      <div className="section-card tl-skeleton-pulse" style={{ height: "72px" }} />
      <div className="section-card tl-skeleton-pulse" style={{ minHeight: "420px" }} />
    </section>
  );
}
