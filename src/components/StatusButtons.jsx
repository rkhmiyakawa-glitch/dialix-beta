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
  disabled = false,
  correctionStatus = "",
  onCorrectionStatusChange,
}) {
  const details = detailOptions[selectedCategory] || [];

  return (
    <section className="panel status-panel">
      <div className="section-heading">
        <h2>コールステータス</h2>
        <div className="status-heading-actions">
          <button
            type="button"
            className={`status-clear-button${
              selectedCategory || selectedStatus ? "" : " is-placeholder"
            }`}
            onClick={onClearStatus}
            disabled={disabled || (!selectedCategory && !selectedStatus)}
            aria-hidden={!selectedCategory && !selectedStatus}
            tabIndex={selectedCategory || selectedStatus ? 0 : -1}
          >
            選択を取り消す
          </button>
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

          {selectedCategory === "内容修正" && (
            <div className="correction-detail-area">
              <p className="status-detail-label">直前の架電履歴を訂正します</p>
              <label className="correction-status-field">
                <span>訂正後のステータス</span>
                <select value={correctionStatus} onChange={(event) => onCorrectionStatusChange?.(event.target.value)} disabled={disabled}>
                  <option value="">選択してください</option>
                  {["留守", "NG", "非決裁NG", "決裁NG", "対象外", "内容相違", "現アナ", "再コール", "再コール留守", "見込み", "非決裁見込み", "決裁見込み", "見込み留守", "トスアップ", "前確依頼", "前確OK", "前確NG"].map((name) => <option key={name} value={name}>{name}</option>)}
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
              <p className="correction-note">新しい架電には加算されず、前回の架電日時と担当APは維持されます。</p>
            </div>
          )}

        </div>
      </div>

    </section>
  );
}
