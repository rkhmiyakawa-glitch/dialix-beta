import React from "react";

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("DIALIX render error", error, info);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <main className="fatal-error-screen">
        <section>
          <p className="eyebrow">SYSTEM ERROR</p>
          <h1>画面の表示中にエラーが発生しました</h1>
          <p>入力済みの内容を確認してから、画面を再読み込みしてください。</p>
          <details><summary>エラー詳細</summary><pre>{this.state.error.message}</pre></details>
          <button type="button" onClick={() => window.location.reload()}>画面を再読み込み</button>
        </section>
      </main>
    );
  }
}
