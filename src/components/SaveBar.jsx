export default function SaveBar({ onSave, onSaveAndNext, isSaving = false }) {
  return (
    <section className="save-bar" aria-busy={isSaving}>
      {isSaving && <span className="save-progress">保存中...</span>}
      <button
        className="secondary-save-button"
        type="button"
        onClick={onSave}
        disabled={isSaving}
      >
        {isSaving ? "保存中" : "保存"}
      </button>

      <button
        className="primary-save-button"
        type="button"
        onClick={onSaveAndNext}
        disabled={isSaving}
      >
        {isSaving ? "処理中..." : "保存して次へ"}
      </button>
    </section>
  );
}
