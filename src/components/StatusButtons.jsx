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
  onClearStatus,
  disabled = false,
}) {
  const details = detailOptions[selectedCategory] || [];

  return (
    <section className="panel">
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
          {selectedCategory === "見込み" && (
            <ReminderPanel
              reminderDate={reminderDate}
              reminderTime={reminderTime}
              onDateChange={onReminderDateChange}
              onTimeChange={onReminderTimeChange}
              disabled={disabled}
              embedded
            />
          )}
        </div>
      )}

      {selectedCategory === "見込み留守" && (
        <div className="status-detail-area">
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
    </section>
  );
}
