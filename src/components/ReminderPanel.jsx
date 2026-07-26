export default function ReminderPanel({
  reminderDate,
  reminderTime,
  onDateChange,
  onTimeChange,
  disabled = false,
  embedded = false,
}) {
  const Wrapper = embedded ? "div" : "section";

  return (
    <Wrapper className={embedded ? "reminder-embedded" : "panel"}>
      <div className="section-heading">
        <h2>リマインド</h2>
        <span>任意</span>
      </div>

      <div className="reminder-grid">
        <label>
          日付
          <input
            type="date"
            value={reminderDate}
            onChange={(event) => onDateChange(event.target.value)}
            disabled={disabled}
          />
        </label>

        <label>
          時間
          <input
            type="time"
            value={reminderTime}
            onChange={(event) => onTimeChange(event.target.value)}
            disabled={disabled}
          />
        </label>
      </div>
    </Wrapper>
  );
}
