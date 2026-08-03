import { useMemo, useState } from "react";

function historyTime(item) {
  if (item.calledAt) return new Date(item.calledAt).getTime() || 0;
  const normalized = String(item.at || "").replace(/\//g, "-");
  return new Date(normalized).getTime() || 0;
}

export default function HistoryTimeline({ history }) {
  const [showHistory, setShowHistory] = useState(true);
  const sortedHistory = useMemo(
    () => [...history].sort((a, b) => historyTime(b) - historyTime(a)),
    [history]
  );

  return (
    <section className="panel history-panel">
      <button
        className="history-toggle"
        type="button"
        onClick={() => setShowHistory((current) => !current)}
      >
        <span>架電履歴</span>
        <span>{showHistory ? "閉じる" : "開く"}</span>
      </button>

      {showHistory && sortedHistory.length > 0 && (
        <div className="timeline">
          {sortedHistory.map((item) => (
            <article className="timeline-item" key={item.id}>
              <div className="timeline-card">
                <div className="history-header">
                  <strong>{item.status}</strong>
                  <time>{item.at}</time>
                </div>
                <p className="history-ap">AP：{item.ap}</p>
                <p>{item.memo}</p>
              </div>
            </article>
          ))}
        </div>
      )}

      {showHistory && sortedHistory.length === 0 && (
        <p className="history-empty">架電履歴はまだありません。</p>
      )}
    </section>
  );
}
