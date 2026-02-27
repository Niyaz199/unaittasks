export default function TaskDetailsLoading() {
  return (
    <section className="grid">
      <div className="section-card tl-skeleton-pulse" style={{ height: "96px" }} />
      <div className="section-card tl-skeleton-pulse" style={{ height: "120px" }} />
      <div className="section-card tl-skeleton-pulse" style={{ height: "80px" }} />
      <div className="section-card tl-skeleton-pulse" style={{ height: "140px" }} />
    </section>
  );
}
