export default function RoundsScanLoading() {
  return (
    <section className="grid">
      <div className="section-card tl-skeleton-pulse" style={{ height: "92px" }} />
      <div className="section-card tl-skeleton-pulse" style={{ minHeight: "220px" }} />
      <div className="section-card tl-skeleton-pulse" style={{ minHeight: "180px" }} />
    </section>
  );
}
