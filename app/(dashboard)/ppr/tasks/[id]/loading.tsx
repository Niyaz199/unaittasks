export default function PprTaskDetailsLoading() {
  return (
    <section className="grid">
      <div className="section-card tl-skeleton-pulse" style={{ height: "96px" }} />
      <div className="section-card tl-skeleton-pulse" style={{ height: "120px" }} />
      <div className="section-card tl-skeleton-pulse" style={{ height: "96px" }} />
      <div className="section-card tl-skeleton-pulse" style={{ minHeight: "200px" }} />
    </section>
  );
}
