export default function PprRoomsLoading() {
  return (
    <section className="grid">
      <div className="section-card tl-skeleton-pulse" style={{ height: "92px" }} />
      <div className="section-card tl-skeleton-pulse" style={{ height: "116px" }} />
      <div className="section-card tl-skeleton-pulse" style={{ minHeight: "420px" }} />
    </section>
  );
}
