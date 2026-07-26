import { useState } from "react";

export default function LoginPage({ onLogin, demoMode }) {
  const [email, setEmail] = useState(demoMode ? "demo@dialix.local" : "");
  const [password, setPassword] = useState(demoMode ? "demo-password" : "");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      await onLogin(email, password);
    } catch (loginError) {
      setError(loginError.message || "ログインに失敗しました。");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="login-page">
      <section className="login-card">
        <div className="brand">
          <span className="brand-mark">D</span>
          <div>
            <h1>DIALIX</h1>
            <p>Call Operation System</p>
          </div>
        </div>

        <div className="login-heading">
          <h2>ログイン</h2>
          <p>
            {demoMode
              ? "現在はデモモードです。そのままログインできます。"
              : "Supabaseに登録したメールアドレスとパスワードを入力してください。"}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          <label htmlFor="email">メールアドレス</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />

          <label htmlFor="password">パスワード</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />

          {error && <p className="form-error">{error}</p>}

          <button type="submit" disabled={submitting}>
            {submitting ? "ログイン中..." : "ログイン"}
          </button>
        </form>

        <p className="version">DIALIX Beta 1.0</p>
      </section>
    </main>
  );
}
