import { useState } from "react";
import Header from "../components/Header";

const STORAGE_KEY = "dialix-shared-links";
function readLinks() { try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); } catch { return []; } }

export default function LinksPage({ currentProfile, onGoLists, onLogout, onOpenAdmin, onOpenMyPage }) {
  const [links, setLinks] = useState(readLinks);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const canAddLinks = ["owner", "admin"].includes(currentProfile?.role);

  function save(next) { setLinks(next); localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); }
  function addLink(event) {
    event.preventDefault();
    if (!name.trim() || !url.trim()) return;
    let normalized = url.trim();
    if (!/^https?:\/\//i.test(normalized)) normalized = `https://${normalized}`;
    save([...links, { id: crypto.randomUUID(), name: name.trim(), url: normalized }]);
    setName(""); setUrl("");
  }

  return <main className="app-page">
    <Header currentProfile={currentProfile} onGoLists={onGoLists} onLogout={onLogout} onOpenAdmin={onOpenAdmin} onOpenMyPage={onOpenMyPage} pageTitle="リンク" />
    <section className="content">
      <div className="page-title"><div><p className="eyebrow">LINKS</p><h1>リンク</h1><p>業務で使うリンクをまとめて管理できます。</p></div></div>
      {canAddLinks && <form className="link-add-form" onSubmit={addLink}><input value={name} onChange={(e) => setName(e.target.value)} placeholder="リンク名" /><input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://example.com" /><button type="submit">追加</button></form>}
      <section className="links-grid">{links.map((link) => <article className="link-card" key={link.id}><a href={link.url} target="_blank" rel="noreferrer"><strong>{link.name}</strong><small>{link.url}</small></a><button type="button" onClick={() => save(links.filter((item) => item.id !== link.id))}>削除</button></article>)}{!links.length && <div className="empty-state">登録されているリンクはありません。</div>}</section>
    </section>
  </main>;
}
