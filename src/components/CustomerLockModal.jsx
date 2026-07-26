export default function CustomerLockModal({ customerName, lockedUsers, onClose }) {
  if (!lockedUsers.length) return null;
  const user = lockedUsers[0];

  return (
    <div className="lock-overlay">
      <section className="lock-modal">
        <div className="lock-icon">🔒</div>
        <p className="eyebrow">CUSTOMER LOCK</p>
        <h2>この顧客は現在利用中です</h2>
        <p className="lock-customer-name">{customerName}</p>
        <p><strong>{user.userName || "他のオペレーター"}</strong>さんが
          {user.callState === "calling" ? "架電中" : "入室中"}です。</p>
        <p className="lock-note">二重架電や上書きを防ぐため、この顧客は開けません。</p>
        <button type="button" onClick={onClose}>顧客一覧へ戻る</button>
      </section>
    </div>
  );
}
