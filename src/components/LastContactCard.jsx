export default function LastContactCard({ lastContact }) {
  return (
    <section className="panel last-contact-panel">
      <p className="eyebrow">LAST CONTACT</p>
      <h2>最終対応</h2>

      <dl>
        <div>
          <dt>日時</dt>
          <dd>{lastContact.at}</dd>
        </div>
        <div>
          <dt>AP</dt>
          <dd>{lastContact.ap}</dd>
        </div>
        <div>
          <dt>ステータス</dt>
          <dd>{lastContact.status}</dd>
        </div>
      </dl>
    </section>
  );
}
