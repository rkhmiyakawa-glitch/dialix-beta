export default function MemoBox({ value, onChange, disabled = false, label = "メモ" }) {
  return (
    <section className="panel">
      <div className="section-heading">
        <label className="field-label" htmlFor="memo">{label}</label>
        <span>{value.length}文字</span>
      </div>

      <textarea
        id="memo"
        rows="7"
        placeholder="話した内容などを入力"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
      />
    </section>
  );
}
