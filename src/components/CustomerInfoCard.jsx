import { useEffect, useState } from "react";

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
  onSaveCustomer,
}) {
  const [isEditingRemarks, setIsEditingRemarks] = useState(false);
  const [draft, setDraft] = useState({});
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    setIsEditingRemarks(false);
    setDraft({
      companyName: customer.companyName || "",
      phone: customer.phone || "",
      phone2: customer.phone2 || "",
      address: customer.address || "",
      industry: customer.industry || "",
      representativeName: customer.representativeName || "",
      businessSubcategory: customer.businessSubcategory || "",
      pinnedMemo: customer.pinnedMemo || "",
    });
  }, [customer.id]);

  function beginRemarksEdit() {
    setDraft({
      companyName: customer.companyName || "",
      phone: customer.phone || "",
      phone2: customer.phone2 || "",
      address: customer.address || "",
      industry: customer.industry || "",
      representativeName: customer.representativeName || "",
      businessSubcategory: customer.businessSubcategory || "",
      pinnedMemo: customer.pinnedMemo || "",
    });
    setIsEditingRemarks(true);
  }

  async function saveRemarks() {
    setIsUpdating(true);
    try {
      await onSaveCustomer(draft);
      setIsEditingRemarks(false);
    } finally {
      setIsUpdating(false);
    }
  }

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
              onClick={() => onZoomCall(customer.phone)}
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

        <div className="customer-phone-row">
          <dt>電話番号2</dt>
          <dd className="customer-value-line phone-line">
            <button
              className="phone-number-link"
              type="button"
              onClick={() => onZoomCall(customer.phone2)}
              disabled={isSaving || !customer.phone2}
              title="電話番号2をクリックして発信"
            >
              {customer.phone2 || "―"}
            </button>
            <button
              className="icon-copy-button"
              type="button"
              onClick={() => onCopyField(customer.phone2, "電話番号2")}
              disabled={isSaving || !customer.phone2}
              aria-label="電話番号2をコピー"
              title="電話番号2をコピー"
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
          label="業種"
          value={customer.industry}
          onCopy={onCopyField}
          copyLabel="業種"
        />

        <DetailRow
          label="代表名"
          value={customer.representativeName}
          onCopy={onCopyField}
          copyLabel="代表名"
        />

        <DetailRow
          label="その他"
          value={customer.businessSubcategory}
          onCopy={onCopyField}
          copyLabel="その他"
        />

        {(customer.status || customer.history?.length > 0) && customer.ap && (
          <DetailRow label="AP" value={customer.ap} onCopy={onCopyField} copyLabel="AP" />
        )}

        <div className="customer-remarks-row">
          <dt>備考</dt>
          <dd className={`customer-remarks-body ${isEditingRemarks ? "is-editing" : "is-viewing"}`}>
            {isEditingRemarks ? (
              <textarea
                rows="4"
                value={draft.pinnedMemo || ""}
                onChange={(event) => setDraft({ ...draft, pinnedMemo: event.target.value })}
                placeholder="常に表示しておきたい情報を入力"
                disabled={isSaving || isUpdating}
                autoFocus
              />
            ) : (
              <div className="customer-remarks-value">{customer.pinnedMemo || "―"}</div>
            )}
          </dd>
          <div className="customer-remarks-action">
            <button
              className={isEditingRemarks ? "primary-button customer-remarks-save-button" : "secondary-button customer-edit-button"}
              type="button"
              onClick={isEditingRemarks ? saveRemarks : beginRemarksEdit}
              disabled={isSaving || isUpdating}
            >
              {isEditingRemarks ? (isUpdating ? "保存中..." : "保存") : "編集"}
            </button>
          </div>
        </div>

        {customer.reminderAt && (
          <div className="customer-reminder-row">
            <dt>リマインド日時</dt>
            <dd>
              <span className={customer.reminderDue ? "customer-reminder-value is-due" : "customer-reminder-value"}>
                {customer.reminderAt}
              </span>
              {customer.reminderDue && <span className="customer-reminder-due-label">期限超過</span>}
            </dd>
          </div>
        )}
      </dl>
    </section>
  );
}
