import { useEffect, useRef, useState } from "react";

export const SEARCH_STATUS_OPTIONS = [
  ["uncontacted", "未架電"],
  ["留守", "留守"],
  ["NG", "NG"],
  ["対象外", "対象外"],
  ["現アナ", "現アナ"],
  ["再コール", "再コール"],
  ["再コール留守", "再コール留守"],
  ["見込み", "見込み"],
  ["見込み留守", "見込み留守"],
  ["トスアップ", "トスアップ"],
  ["前確依頼", "前確依頼"],
  ["前確NG", "前確NG"],
  ["前確OK", "前確OK"],
];

export default function StatusMultiSelect({ value, onChange, ariaLabel = "ステータス" }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const selected = Array.isArray(value) ? value : [];

  useEffect(() => {
    function closeOnOutsideClick(event) {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    }
    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, []);

  function toggle(status) {
    onChange(
      selected.includes(status)
        ? selected.filter((item) => item !== status)
        : [...selected, status]
    );
  }

  const selectedLabels = SEARCH_STATUS_OPTIONS
    .filter(([status]) => selected.includes(status))
    .map(([, label]) => label);
  const buttonText =
    selectedLabels.length === 0
      ? "ステータス：すべて"
      : selectedLabels.length <= 2
        ? selectedLabels.join("・")
        : `${selectedLabels.length}件選択中`;

  return (
    <div className="status-multi-select" ref={rootRef}>
      <button
        className="status-multi-trigger"
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <span>{buttonText}</span><span className="status-multi-arrow">⌄</span>
      </button>
      {open && (
        <div className="status-multi-menu">
          <div className="status-multi-menu-head">
            <strong>ステータスを選択</strong>
            <button type="button" onClick={() => onChange([])} disabled={selected.length === 0}>
              すべて解除
            </button>
          </div>
          {SEARCH_STATUS_OPTIONS.map(([status, label]) => (
            <label key={status}>
              <input
                type="checkbox"
                checked={selected.includes(status)}
                onChange={() => toggle(status)}
              />
              <span>{label}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
