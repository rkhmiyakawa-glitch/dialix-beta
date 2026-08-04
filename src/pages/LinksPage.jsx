import { useCallback, useEffect, useState } from "react";
import Header from "../components/Header";
import { createSharedLink, deleteSharedLink, fetchSharedLinks, reorderSharedLinks } from "../services/linkService";

export default function LinksPage({ currentProfile, onGoLists, onLogout, onOpenAdmin, onOpenMyPage, overdueReminderCount }) {
  const [links, setLinks] = useState([]);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const normalizedRole = String(currentProfile?.role || "").trim().toLowerCase();
  const canManageLinks = ["owner", "admin", "オーナー", "管理者"].includes(normalizedRole);

  const loadLinks = useCallback(async () => {
    setLoading(true);
    try {
      setLinks(await fetchSharedLinks());
      setError("");
    } catch (e) {
      setError(e.message || "リンクを取得できませんでした。");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadLinks(); }, [loadLinks]);

  async function addLink(event) {
    event.preventDefault();
    if (!canManageLinks || !name.trim() || !url.trim() || saving) return;

    let normalized = url.trim();
    if (!/^https?:\/\//i.test(normalized)) normalized = `https://${normalized}`;

    setSaving(true);
    try {
      const created = await createSharedLink({
        name: name.trim(),
        url: normalized,
        sortOrder: links.length + 1,
      });
      setLinks((current) => [...current, created]);
      setName("");
      setUrl("");
      setError("");
    } catch (e) {
      setError(e.message || "リンクの追加に失敗しました。");
    } finally {
      setSaving(false);
    }
  }

  async function moveLink(index, direction) {
    if (!canManageLinks || saving) return;
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= links.length) return;

    const previous = links;
    const next = [...links];
    [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
    setLinks(next);
    setSaving(true);
    try {
      await reorderSharedLinks(next);
      setError("");
    } catch (e) {
      setLinks(previous);
      setError(e.message || "表示順の更新に失敗しました。");
    } finally {
      setSaving(false);
    }
  }

  async function removeLink(id) {
    if (!canManageLinks || saving) return;
    setSaving(true);
    try {
      await deleteSharedLink(id);
      const next = links.filter((item) => item.id !== id);
      setLinks(next);
      if (next.length) await reorderSharedLinks(next);
      setError("");
    } catch (e) {
      setError(e.message || "リンクの削除に失敗しました。");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="app-page">
      <Header
        currentProfile={currentProfile}
        onGoLists={onGoLists}
        onLogout={onLogout}
        onOpenAdmin={onOpenAdmin}
        onOpenMyPage={onOpenMyPage}
        pageTitle="リンク"
        overdueReminderCount={overdueReminderCount}
      />

      <section className="content">
        <div className="page-title">
          <div>
            <p className="eyebrow">LINKS</p>
            <h1>リンク</h1>
            <p>業務で使う共通リンクをまとめて確認できます。</p>
          </div>
        </div>

        <section className="admin-panel management-list-panel reminder-page-panel links-page-panel">
          <div className="admin-panel-head management-list-head">
            <h2>リンク一覧</h2>
            <span>{loading ? "読み込み中" : `${links.length}件`}</span>
          </div>

          {canManageLinks && (
            <form className="link-add-form" onSubmit={addLink}>
              <input value={name} onChange={(event) => setName(event.target.value)} placeholder="リンク名" disabled={saving} />
              <input value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://example.com" disabled={saving} />
              <button type="submit" disabled={saving}>{saving ? "保存中..." : "追加"}</button>
            </form>
          )}

          {error && <div className="links-panel-message">{error}</div>}
          {loading && <div className="links-panel-message">リンクを読み込んでいます...</div>}

          {!loading && links.length > 0 && (
            <div className="task-list">
              {links.map((link, index) => (
                <article className="task-row link-task-row" key={link.id}>
                  <a href={link.url} target="_blank" rel="noreferrer">
                    <div>
                      <strong>{link.name}</strong>
                      <small>{link.url}</small>
                    </div>
                  </a>

                  <div className="task-row-meta link-card-actions">
                    <b className="link-open-label">開く ›</b>
                    {canManageLinks && (
                      <div className="link-order-actions" aria-label={`${link.name}の表示順`}>
                        <button type="button" className="link-order-button" onClick={() => moveLink(index, -1)} disabled={saving || index === 0} aria-label={`${link.name}を上へ移動`} title="上へ移動">↑</button>
                        <button type="button" className="link-order-button" onClick={() => moveLink(index, 1)} disabled={saving || index === links.length - 1} aria-label={`${link.name}を下へ移動`} title="下へ移動">↓</button>
                      </div>
                    )}
                    {canManageLinks && (
                      <button type="button" className="link-delete-button" disabled={saving} onClick={() => removeLink(link.id)}>削除</button>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}

          {!loading && !links.length && !error && <div className="links-panel-message">登録されているリンクはありません。</div>}
        </section>
      </section>
    </main>
  );
}
