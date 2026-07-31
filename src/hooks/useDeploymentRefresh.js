import { useEffect, useRef } from "react";

const VERSION_URL = "/version.json";

export default function useDeploymentRefresh({ navigationKey, hasUnsavedChanges }) {
  const checkingRef = useRef(false);

  useEffect(() => {
    if (hasUnsavedChanges || checkingRef.current) return undefined;

    let cancelled = false;
    const controller = new AbortController();

    async function checkVersion() {
      checkingRef.current = true;
      try {
        const separator = VERSION_URL.includes("?") ? "&" : "?";
        const response = await fetch(`${VERSION_URL}${separator}t=${Date.now()}`, {
          cache: "no-store",
          headers: { "Cache-Control": "no-cache" },
          signal: controller.signal,
        });
        if (!response.ok) return;

        const deployed = await response.json();
        const deployedVersion = String(deployed?.version || "").trim();
        if (!deployedVersion || deployedVersion === __APP_VERSION__) return;

        if (!cancelled && !hasUnsavedChanges) window.location.reload();
      } catch (error) {
        if (error?.name !== "AbortError") {
          // オフラインや一時的な通信失敗では操作を止めず、次のページ移動で再確認する。
        }
      } finally {
        checkingRef.current = false;
      }
    }

    checkVersion();
    return () => {
      cancelled = true;
      controller.abort();
      checkingRef.current = false;
    };
  }, [navigationKey, hasUnsavedChanges]);
}
