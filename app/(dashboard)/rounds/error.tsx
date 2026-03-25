"use client";

type Props = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function RoundsModuleError({ reset }: Props) {
  return (
    <section className="grid">
      <div className="section-card grid" style={{ gap: "0.9rem" }}>
        <div>
          <h2 style={{ margin: 0 }}>Не удалось загрузить экран обходов</h2>
          <div className="text-soft" style={{ marginTop: "0.45rem" }}>
            Попробуйте повторить загрузку. Если ошибка повторяется, вернитесь в модуль обходов и откройте нужный раздел заново.
          </div>
        </div>
        <div className="row" style={{ gap: "0.65rem", flexWrap: "wrap" }}>
          <button type="button" className="btn btn-accent" onClick={reset}>
            Повторить
          </button>
          <a href="/rounds" className="btn btn-ghost">
            К модулю обходов
          </a>
        </div>
      </div>
    </section>
  );
}
