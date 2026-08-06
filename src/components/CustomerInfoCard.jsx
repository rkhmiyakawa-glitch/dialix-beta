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
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState({});
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    setIsEditing(false);
    setDraft({
      companyName: customer.companyName || "",
      phone: customer.phone || "",
      phone2: customer.phone2 || "",
      address: customer.address || "",
      businessSubcategory: customer.businessSubcategory || "",
      pinnedMemo: customer.pinnedMemo || "",
    });
  }, [customer.id]);

  function beginEdit() {
    setDraft({
      companyName: customer.companyName || "",
      phone: customer.phone || "",
      phone2: customer.phone2 || "",
      address: customer.address || "",
      businessSubcategory: customer.businessSubcategory || "",
      pinnedMemo: customer.pinnedMemo || "",
    });
    setIsEditing(true);
  }

  async function saveEdit() {
    setIsUpdating(true);
    try {
      await onSaveCustomer(draft);
      setIsEditing(false);
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
          {!isEditing && <button className="secondary-button customer-edit-button" type="button" onClick={beginEdit} disabled={isSaving}>編集</button>}
          <span className="room-status">入室中</span>
          <span className={callState === "calling" ? "call-status active" : "call-status"}>
            {callState === "calling" ? "架電中" : "待機中"}
          </span>
        </div>
      </div>

      {isEditing ? (
        <div className="customer-edit-form">
          <label>顧客名<input value={draft.companyName} onChange={(e) => setDraft({ ...draft, companyName: e.target.value })} /></label>
          <label>電話番号<input value={draft.phone} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} /></label>
          <label>電話番号2<input value={draft.phone2} onChange={(e) => setDraft({ ...draft, phone2: e.target.value })} /></label>
          <label>住所<input value={draft.address} onChange={(e) => setDraft({ ...draft, address: e.target.value })} /></label>
          <label>詳細<textarea rows="3" value={draft.businessSubcategory} onChange={(e) => setDraft({ ...draft, businessSubcategory: e.target.value })} /></label>
          <div className="customer-edit-actions">
            <button className="secondary-button" type="button" onClick={() => setIsEditing(false)} disabled={isUpdating}>キャンセル</button>
            <button className="primary-button" type="button" onClick={saveEdit} disabled={isUpdating}>{isUpdating ? "保存中..." : "顧客情報を保存"}</button>
          </div>
        </div>
      ) : <dl className="customer-details customer-details-v106">
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
          label="詳細"
          value={customer.businessSubcategory}
          onCopy={onCopyField}
          copyLabel="詳細"
        />

        {(customer.status || customer.history?.length > 0) && customer.ap && (
          <DetailRow label="AP" value={customer.ap} onCopy={onCopyField} copyLabel="AP" />
        )}

        <div className="customer-remarks-row">
          <dt>備考</dt>
          <dd>
            <textarea
              rows="4"
              value={draft.pinnedMemo || ""}
              onChange={(event) => setDraft({ ...draft, pinnedMemo: event.target.value })}
              placeholder="常に表示しておきたい情報を入力"
              disabled={isSaving || isUpdating}
            />
            <div className="customer-remarks-actions">
              <button
                className="primary-button"
                type="button"
                onClick={saveEdit}
                disabled={isSaving || isUpdating || (draft.pinnedMemo || "") === (customer.pinnedMemo || "")}
              >
                {isUpdating ? "保存中..." : "備考を保存"}
              </button>
            </div>
          </dd>
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
      </dl>}
    </section>
  );
}
