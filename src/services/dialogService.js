let openDialog = null;

export function registerDialogHandler(handler) {
  openDialog = handler;
  return () => { if (openDialog === handler) openDialog = null; };
}

function request(options) {
  if (!openDialog) return Promise.resolve(options.type === "confirm" ? false : options.type === "prompt" ? null : undefined);
  return openDialog(options);
}

export const dialog = {
  alert(message, options = {}) {
    return request({ type: "alert", title: options.title || "お知らせ", message: String(message), ...options });
  },
  confirm(message, options = {}) {
    return request({ type: "confirm", title: options.title || "確認", message: String(message), ...options });
  },
  prompt(message, defaultValue = "", options = {}) {
    return request({ type: "prompt", title: options.title || "入力", message: String(message), defaultValue: String(defaultValue || ""), ...options });
  },
};
