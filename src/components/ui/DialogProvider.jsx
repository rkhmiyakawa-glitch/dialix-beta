import { useEffect, useRef, useState } from "react";
import { registerDialogHandler } from "../../services/dialogService";

export default function DialogProvider({ children }) {
  const [current, setCurrent] = useState(null);
  const [value, setValue] = useState("");
  const queue = useRef([]);

  useEffect(() => registerDialogHandler((options) => new Promise((resolve) => {
    queue.current.push({ options, resolve });
    setCurrent((active) => active || queue.current.shift());
  })), []);

  useEffect(() => {
    if (current?.options.type === "prompt") setValue(current.options.defaultValue || "");
  }, [current]);

  function close(result) {
    current?.resolve(result);
    setCurrent(queue.current.shift() || null);
  }

  useEffect(() => {
    if (!current) return undefined;
    const onKeyDown = (event) => {
      if (event.key === "Escape") close(current.options.type === "confirm" ? false : current.options.type === "prompt" ? null : undefined);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [current]);

  const options = current?.options;
  return <>
    {children}
    {options && <div className="lock-overlay app-dialog-overlay" role="presentation">
      <section className="edit-modal app-dialog-modal" role="dialog" aria-modal="true" aria-labelledby="app-dialog-title">
        <h2 id="app-dialog-title">{options.title}</h2>
        <p className="app-dialog-message">{options.message}</p>
        {options.type === "prompt" && <input className="app-dialog-input" autoFocus value={value} onChange={(event) => setValue(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") close(value); }} />}
        <div className="modal-actions app-dialog-actions">
          {options.type !== "alert" && <button type="button" className="secondary-button" onClick={() => close(options.type === "confirm" ? false : null)}>{options.cancelLabel || "キャンセル"}</button>}
          <button type="button" autoFocus={options.type !== "prompt"} className={options.danger ? "danger-button" : "primary-button"} onClick={() => close(options.type === "confirm" ? true : options.type === "prompt" ? value : undefined)}>{options.confirmLabel || (options.type === "alert" ? "閉じる" : "決定")}</button>
        </div>
      </section>
    </div>}
  </>;
}
