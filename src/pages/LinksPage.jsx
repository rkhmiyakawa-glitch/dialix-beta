import { useState } from "react";
import Header from "../components/Header";

const STORAGE_KEY = "dialix-shared-links";

function readLinks() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

export default function LinksPage({ currentProfile, onGoLists, onLogout, onOpenAdmin, onOpenMyPage }) {
  const [links, setLinks] = useState(readLinks);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const canManageLinks = ["owner", "admin"].includes(currentProfile?.role);

  function save(next) {
    setLinks(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }

  function addLink(event) {
    event.preventDefault();
    if (!name.trim() || !url.trim()) return;

    let normalized = url.trim();
    if (!/^https?:\/\//i.test(normalized)) normalized = `https://${normalized}`;

    save([...links, { id: crypto.randomUUID(), name: name.trim(), url: normalized }]);
    setName("");
    setUrl("");
  }

  function moveLink(index, direction) {
    if (!canManageLinks) return;

    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= links.length) return;

    const next = [...links];
    [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
    save(next);
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
      />

      <section className="content">
        <div className="page-title">
          <div>
            <p className="eyebrow">LINKS</p>
            <h1>リンク</h1>
            <p>業務で使うリンクをまとめて確認できます。</p>
          </div>
        </div>

        {canManageLinks && (
          <form className="link-add-form" onSubmit={addLink}>
            <input value={name} onChange={(event) => setName(event.target.value)} placeholder="リンク名" />
            <input value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://example.com" />
            <button type="submit">追加</button>
          </form>
        )}

        <section className="links-grid">
          {links.map((link, index) => (
            <article className="link-card" key={link.id}>
              <a href={link.url} target="_blank" rel="noreferrer">
                <strong>{link.name}</strong>
                <small>{link.url}</small>
              </a>

              <div className="link-card-actions">
                {canManageLinks && (
                  <div className="link-order-actions" aria-label={`${link.name}の表示順`}>
                    <button
                      type="button"
                      className="link-order-button"
                      onClick={() => moveLink(index, -1)}
                      disabled={index === 0}
                      aria-label={`${link.name}を上へ移動`}
                      title="上へ移動"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      className="link-order-button"
                      onClick={() => moveLink(index, 1)}
                      disabled={index === links.length - 1}
                      aria-label={`${link.name}を下へ移動`}
                      title="下へ移動"
                    >
                      ↓
                    </button>
                  </div>
                )}

                {canManageLinks && (
                  <button
                    type="button"
                    className="link-delete-button"
                    onClick={() => save(links.filter((item) => item.id !== link.id))}
                  >
                    削除
                  </button>
                )}
              </div>
            </article>
          ))}

          {!links.length && <div className="empty-state">登録されているリンクはありません。</div>}
        </section>
      </section>
    </main>
  );
}
