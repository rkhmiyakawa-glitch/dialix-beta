function CopyIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" width="17" height="17">
      <path
        d="M9 8.25A2.25 2.25 0 0 1 11.25 6h7.5A2.25 2.25 0 0 1 21 8.25v10.5A2.25 2.25 0 0 1 18.75 21h-7.5A2.25 2.25 0 0 1 9 18.75V8.25Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="M15 6V5.25A2.25 2.25 0 0 0 12.75 3h-7.5A2.25 2.25 0 0 0 3 5.25v10.5A2.25 2.25 0 0 0 5.25 18H9"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function DetailRow({ label, value, onCopy, copyLabel }) {
  const displayValue = value || "―";

  return (
    <div>
      <dt>{label}</dt>
      <dd className="customer-value-line">
        <span>{displayValue}</span>
        <button
          className="icon-copy-button"
          type="button"
          onClick={() => onCopy(value, copyLabel)}
          disabled={!value}
          aria-label={`${copyLabel}をコピー`}
          title={`${copyLabel}をコピー`}
        >
          <CopyIcon />
        </button>
      </dd>
    </div>
  );
}

export default function CustomerInfoCard({
  customer,
  callState,
  onZoomCall,
  onCopyField,
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

      <dl className="customer-details customer-details-v106">
        <DetailRow
          label="顧客ID"
          value={customer.id}
          onCopy={onCopyField}
          copyLabel="顧客ID"
        />

        <div className="customer-phone-row">
          <dt>電話番号</dt>
          <dd className="customer-value-line phone-line">
            <button
              className="phone-number-link"
              type="button"
              onClick={onZoomCall}
              disabled={isSaving || !customer.phone}
              title="電話番号をクリックして発信"
            >
              {customer.phone || "―"}
            </button>
            <button
              className="icon-copy-button"
              type="button"
              onClick={() => onCopyField(customer.phone, "電話番号")}
              disabled={isSaving || !customer.phone}
              aria-label="電話番号をコピー"
              title="電話番号をコピー"
            >
              <CopyIcon />
            </button>
          </dd>
        </div>

        <DetailRow
          label="住所"
          value={customer.address}
          onCopy={onCopyField}
          copyLabel="住所"
        />

        <DetailRow
          label="詳細"
          value={customer.businessSubcategory}
          onCopy={onCopyField}
          copyLabel="詳細"
        />

        <DetailRow
          label="AP"
          value={customer.ap}
          onCopy={onCopyField}
          copyLabel="AP"
        />
      </dl>
    </section>
  );
}
