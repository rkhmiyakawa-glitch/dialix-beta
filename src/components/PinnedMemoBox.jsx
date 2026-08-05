import { useEffect, useState } from "react";

export default function PinnedMemoBox({ value = "", onSave, disabled = false }) {
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);
  const isDirty = draft !== value;

  useEffect(() => setDraft(value), [value]);

  async function handleSave() {
    if (!isDirty || saving) return;
    setSaving(true);
    try {
      await onSave(draft);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="panel pinned-memo-box">
      <div className="section-heading pinned-memo-heading">
        <div><span className="pin-mark" aria-hidden="true">●</span><label className="field-label" htmlFor="pinned-memo">ピン留めメモ</label></div>
        <span>{draft.length}文字</span>
      </div>
      <textarea
        id="pinned-memo"
        rows="4"
        placeholder="常に表示しておきたい情報を入力"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        disabled={disabled || saving}
      />
      <div className="pinned-memo-actions">
        <span>架電履歴・KPIには追加されません</span>
        <button className="primary-button" type="button" onClick={handleSave} disabled={!isDirty || disabled || saving}>{saving ? "保存中..." : "ピン留めメモを保存"}</button>
      </div>
    </section>
  );
}
