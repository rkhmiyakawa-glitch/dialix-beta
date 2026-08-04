import Header from "../components/Header";

export default function ReminderListPage({
  mode,
  tasks,
  currentProfile,
  onLogout,
  onGoLists,
  onOpenAdmin,
  onOpenMyPage,
  onOpenTask,
}) {
  const isToday = mode === "today";
  const items = isToday ? (tasks?.dueToday || []) : (tasks?.allReminders || []);
  const title = isToday ? "本日のリマインド" : "リマインド一覧";
  const eyebrow = isToday ? "TODAY REMINDERS" : "REMINDERS";
  const description = isToday
    ? "本日対応予定のリマインド案件を確認できます。"
    : "本日以降に設定されているリマインド案件を確認できます。";

  return (
    <main className="app-page">
      <Header
        onLogout={onLogout}
        onGoLists={onGoLists}
        currentProfile={currentProfile}
        onOpenAdmin={onOpenAdmin}
        onOpenMyPage={onOpenMyPage}
        pageTitle={title}
      />
      <section className="content">
        <div className="page-title">
          <div>
            <p className="eyebrow">{eyebrow}</p>
            <h1>{title}</h1>
            <p>{description}</p>
          </div>
        </div>

        <section className="task-panel reminder-page-panel">
          <div className="task-panel-head">
            <h2>{title}</h2>
            <span>最大{isToday ? 100 : 300}件を表示</span>
          </div>
          {items.length === 0 ? (
            <div className="empty-state">現在、対象の顧客はいません。</div>
          ) : (
            <div className="task-list">
              {items.map((item) => (
                <button
                  className="task-row"
                  key={item.id}
                  type="button"
                  onClick={() => onOpenTask(item, items, title)}
                >
                  <div>
                    <strong>{item.companyName}</strong>
                    <small>{item.listName}・{item.phone}</small>
                  </div>
                  <div className="task-row-meta">
                    <span>{item.reminderAt || item.status || "未架電"}</span>
                    <b>開く ›</b>
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>
      </section>
    </main>
  );
}
