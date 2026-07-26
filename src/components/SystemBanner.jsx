export default function SystemBanner({ demoMode, error }) {
  if (!demoMode && !error) return null;

  return (
    <div className={error ? "system-banner error" : "system-banner"}>
      {error
        ? `データ取得エラー：${error}`
        : "デモモード：.env未設定のためサンプルデータで動作しています。"}
    </div>
  );
}
