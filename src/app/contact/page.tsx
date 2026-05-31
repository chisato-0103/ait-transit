"use client";
import { useState } from "react";

// FormspreeのフォームIDを環境変数で管理
// NEXT_PUBLIC_FORMSPREE_ID を .env.local に設定してください
const FORMSPREE_ID = process.env.NEXT_PUBLIC_FORMSPREE_ID ?? "YOUR_FORM_ID";

export default function ContactPage() {
  const [status, setStatus] = useState<"idle" | "sending" | "success" | "error">("idle");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("sending");
    const form = e.currentTarget;
    const data = new FormData(form);

    const res = await fetch(`https://formspree.io/f/${FORMSPREE_ID}`, {
      method: "POST",
      body: data,
      headers: { Accept: "application/json" },
    });

    if (res.ok) {
      setStatus("success");
      form.reset();
    } else {
      setStatus("error");
    }
  }

  return (
    <div className="app">
      <header className="header">
        <h1>お問い合わせ</h1>
        <p>愛工大交通情報システム</p>
      </header>
      <div className="container">
        {status === "success" ? (
          <div className="route-card" style={{ padding: "2rem", textAlign: "center" }}>
            <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>✅</div>
            <p>送信が完了しました。ありがとうございます。</p>
            <a href="/" className="btn btn-primary" style={{ display: "inline-block", marginTop: "1rem" }}>
              トップに戻る
            </a>
          </div>
        ) : (
          <div className="search-area">
            <div className="section-header">📩 お問い合わせフォーム</div>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label htmlFor="name">お名前</label>
                <input
                  id="name"
                  name="name"
                  type="text"
                  required
                  style={{ width: "100%", padding: "0.5rem", border: "1px solid #ddd", borderRadius: "6px", fontSize: "1rem" }}
                />
              </div>
              <div className="form-group">
                <label htmlFor="email">メールアドレス</label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  style={{ width: "100%", padding: "0.5rem", border: "1px solid #ddd", borderRadius: "6px", fontSize: "1rem" }}
                />
              </div>
              <div className="form-group">
                <label htmlFor="message">メッセージ</label>
                <textarea
                  id="message"
                  name="message"
                  required
                  rows={5}
                  style={{ width: "100%", padding: "0.5rem", border: "1px solid #ddd", borderRadius: "6px", fontSize: "1rem", resize: "vertical" }}
                />
              </div>
              {status === "error" && (
                <p style={{ color: "var(--danger)", marginBottom: "0.5rem" }}>送信に失敗しました。しばらくしてから再試行してください。</p>
              )}
              <button type="submit" className="btn btn-primary" disabled={status === "sending"}>
                {status === "sending" ? "送信中..." : "送信する"}
              </button>
            </form>
          </div>
        )}
        <div style={{ marginTop: "1rem", textAlign: "center" }}>
          <a href="/">← トップに戻る</a>
        </div>
      </div>
    </div>
  );
}
