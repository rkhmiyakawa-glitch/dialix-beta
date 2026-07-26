export default function CustomerInfoCard({
  customer,
  callState,
  onZoomCall,
  onCopyPhone,
  isSaving = false,
}) {
  return (
    <section className="panel customer-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">CUSTOMER</p>
          <h1>{customer.companyName}</h1>
        </div>

        <div className="presence-badges">
          <span className="room-status">入室中</span>
          <span className={callState === "calling" ? "call-status active" : "call-status"}>
            {callState === "calling" ? "架電中" : "待機中"}
          </span>
        </div>
      </div>

      <dl className="customer-details customer-details-v104">
        <div className="customer-id-row"><dt>顧客ID</dt><dd>{customer.id}</dd></div>
        <div className="customer-phone-row">
          <dt>電話番号</dt>
          <dd className="phone-line">
            <span className="phone-number">{customer.phone}</span>
            <div className="phone-actions">
              <button className="copy-button" type="button" onClick={onCopyPhone} disabled={isSaving}>
                番号をコピー
              </button>
              <button className="call-button" type="button" onClick={onZoomCall} disabled={isSaving}>
                Zoom Phoneで発信
              </button>
            </div>
          </dd>
        </div>
        <div className="customer-address-row"><dt>住所</dt><dd>{customer.address}</dd></div>
        {customer.businessSubcategory && <div className="customer-business-row"><dt>詳細</dt><dd>{customer.businessSubcategory}</dd></div>}
        <div className="customer-ap-row"><dt>AP</dt><dd>{customer.ap}</dd></div>
      </dl>
    </section>
  );
}
