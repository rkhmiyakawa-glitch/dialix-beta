export default function SaveBar({
  onSave,
  onPrevious,
  onNext,
  isSaving = false,
  isDirty = false,
  hasPrevious = false,
  hasNext = false,
}) {
  return (
    <section className="save-bar" aria-busy={isSaving}>
      {isSaving && <span className="save-progress">保存中...</span>}
      <button
        className="save-navigation-button"
        type="button"
        onClick={onPrevious}
        disabled={isSaving || !hasPrevious}
      >
        ← 前の顧客
      </button>
      <div className="save-bar-right">
        <button
          className="save-navigation-button"
          type="button"
          onClick={onSave}
          disabled={isSaving || !isDirty}
        >
          {isSaving ? "保存中..." : isDirty ? "保存" : "保存済み"}
        </button>
        <button
          className="save-navigation-button"
          type="button"
          onClick={onNext}
          disabled={isSaving || !hasNext}
        >
          次の顧客 →
        </button>
      </div>
    </section>
  );
}
