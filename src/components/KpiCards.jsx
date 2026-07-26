export default function KpiCards({ items }) {
  return (
    <section className="kpi-strip" aria-label="今日のKPI">
      <div className="kpi-strip-heading">
        <div>
          <p className="eyebrow">TODAY&apos;S KPI</p>
          <h2>今日のKPI</h2>
        </div>
        <span>最終更新 15:30</span>
      </div>

      <div className="kpi-grid">
        {items.map((item) => (
          <article className="kpi-card" key={item.label}>
            <span>{item.label}</span>
            <strong>{item.value}</strong>
            <small>{item.unit}</small>
          </article>
        ))}
      </div>
    </section>
  );
}
