export default function RoundsArchiveLoading() {
  return (
    <section className="grid">
      <div className="section-card tl-skeleton-pulse" style={{ height: "92px" }} />
      <div className="section-card tl-skeleton-pulse" style={{ height: "132px" }} />
      <div className="section-card tl-skeleton-pulse" style={{ minHeight: "360px" }} />
    </section>
  );
}
