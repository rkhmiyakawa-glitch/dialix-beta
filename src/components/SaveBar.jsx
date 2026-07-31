export default function SaveBar({ onSave, isSaving = false, isDirty = false }) {
  return (
    <section className="save-bar" aria-busy={isSaving}>
      {isSaving && <span className="save-progress">保存中...</span>}
      <button
        className="primary-save-button"
        type="button"
        onClick={onSave}
        disabled={isSaving || !isDirty}
      >
        {isSaving ? "保存中..." : isDirty ? "保存" : "保存済み"}
      </button>
    </section>
  );
}
