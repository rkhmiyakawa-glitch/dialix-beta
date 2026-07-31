import ReminderPanel from "./ReminderPanel";

const detailOptions = {
  NG: [
    { name: "非決裁NG", tone: "slate" },
    { name: "決裁NG", tone: "red" },
  ],
  見込み: [
    { name: "非決裁見込み", tone: "green" },
    { name: "決裁見込み", tone: "green" },
  ],
};

export default function StatusButtons({
  statuses,
  selectedStatus,
  selectedCategory,
  onSelectCategory,
  onSelectStatus,
  reminderDate,
  reminderTime,
  onReminderDateChange,
  onReminderTimeChange,
  assignableProfiles = [],
  selectedAssigneeId = "",
  onAssigneeChange,
  onClearStatus,
  onSave,
  isDirty = false,
  isSaving = false,
  disabled = false,
}) {
  const details = detailOptions[selectedCategory] || [];

  return (
    <section className="panel status-panel">
      <div className="section-heading">
        <h2>コールステータス</h2>
        <div className="status-heading-actions">
          <span>必須</span>
          {(selectedCategory || selectedStatus) && (
            <button
              type="button"
              className="status-clear-button"
              onClick={onClearStatus}
              disabled={disabled}
            >
              選択を取り消す
            </button>
          )}
        </div>
      </div>

      <div className="status-workspace">
        <div className="status-grid">
          {statuses.map((status) => (
            <button
              key={status.name}
              type="button"
              className={
                selectedCategory === status.name
                  ? `status-button ${status.tone} is-selected`
                  : `status-button ${status.tone}`
              }
              onClick={() => onSelectCategory(status.name)}
              disabled={disabled}
            >
              {status.name}
            </button>
          ))}
        </div>

        <div className="status-side-area">
          {details.length > 0 && (
            <div className="status-detail-area">
              <p className="status-detail-label">詳細ステータスを選択してください</p>
              <div className="status-detail-grid">
                {details.map((detail) => (
                  <button
                    key={detail.name}
                    type="button"
                    className={
                      selectedStatus === detail.name
                        ? `status-button status-detail-button ${detail.tone} is-selected`
                        : `status-button status-detail-button ${detail.tone}`
                    }
                    onClick={() => onSelectStatus(detail.name)}
                    disabled={disabled}
                  >
                    {detail.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {(selectedCategory === "見込み" || selectedCategory === "見込み留守") && (
            <div className="status-reminder-area">
              <ReminderPanel
                reminderDate={reminderDate}
                reminderTime={reminderTime}
                onDateChange={onReminderDateChange}
                onTimeChange={onReminderTimeChange}
                disabled={disabled}
                embedded
              />
            </div>
          )}

          {selectedCategory === "前確依頼" && (
            <div className="precheck-detail-area">
              <label className="precheck-assignee">
                <span>詳細ステータス（担当AP・任意）</span>
                <select
                  value={selectedAssigneeId}
                  onChange={(event) => onAssigneeChange?.(event.target.value)}
                  disabled={disabled}
                >
                  <option value="">選択しない</option>
                  {assignableProfiles.map((profile) => (
                    <option key={profile.id} value={profile.id}>
                      {profile.displayName}
                    </option>
                  ))}
                </select>
              </label>
              <div className="status-reminder-area">
                <ReminderPanel
                  reminderDate={reminderDate}
                  reminderTime={reminderTime}
                  onDateChange={onReminderDateChange}
                  onTimeChange={onReminderTimeChange}
                  disabled={disabled}
                  embedded
                />
              </div>
            </div>
          )}

          {!details.length && selectedCategory !== "見込み留守" && selectedCategory !== "前確依頼" && (
            <div className="status-side-placeholder">
              ステータスを選択すると、必要な詳細項目がここに表示されます。
            </div>
          )}
        </div>
      </div>

      <div className="status-save-area">
        <button
          className="primary-save-button"
          type="button"
          onClick={onSave}
          disabled={isSaving || !isDirty}
        >
          {isSaving ? "保存中..." : isDirty ? "保存" : "保存済み"}
        </button>
      </div>
    </section>
  );
}
