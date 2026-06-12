"use client";
import { useState } from "react";

const CATEGORIES = ["データの誤りの報告", "不具合の報告", "機能の要望", "その他"] as const;
const MESSAGE_MAX = 2000;

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "0.6rem",
  border: "1px solid #ddd",
  borderRadius: "6px",
  fontSize: "1rem",
};

export default function ContactPage() {
  const [status, setStatus] = useState<"idle" | "sending" | "success" | "error" | "not_configured">("idle");
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>("データの誤りの報告");
  const [message, setMessage] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  const messageTooShort = message.trim().length > 0 && message.trim().length < 10;
  const canSubmit = message.trim().length >= 10 && message.length <= MESSAGE_MAX && status !== "sending";

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!canSubmit) return;
    setStatus("sending");
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          category,
          message,
          // ハニーポット（人間には見えない欄。botが埋めたら破棄される）
          website: (e.currentTarget.elements.namedItem("website") as HTMLInputElement)?.value ?? "",
        }),
      });
      if (res.ok) {
        setStatus("success");
      } else if (res.status === 503) {
        setStatus("not_configured");
      } else {
        setStatus("error");
      }
    } catch {
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
            <p style={{ fontSize: "0.85rem", color: "#666", marginTop: "0.5rem" }}>
              データの誤りのご報告は確認のうえ、公式情報と照合して修正します。
            </p>
            <a href="/" className="btn btn-primary" style={{ display: "inline-block", marginTop: "1rem" }}>
              トップに戻る
            </a>
          </div>
        ) : (
          <div className="search-area" style={{ padding: "1rem" }}>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label htmlFor="category">種類</label>
                <select
                  id="category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value as (typeof CATEGORIES)[number])}
                  style={inputStyle}
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              {category === "データの誤りの報告" && (
                <div className="extra-shuttle-notice" style={{ marginBottom: "1rem" }}>
                  時刻の誤りは「路線・駅・方向・時刻・確認した日」を書いていただけると、公式時刻表との照合がすぐできます。
                </div>
              )}

              <div className="form-group">
                <label htmlFor="message">
                  内容 <span style={{ color: "#c00" }}>必須</span>
                  <span style={{ float: "right", fontSize: "0.8rem", color: message.length > MESSAGE_MAX ? "#c00" : "#888" }}>
                    {message.length}/{MESSAGE_MAX}
                  </span>
                </label>
                <textarea
                  id="message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  required
                  rows={6}
                  placeholder="例: 6/12(金) 八草駅 12:13発のリニモが実際には12:15発でした"
                  style={{ ...inputStyle, resize: "vertical" }}
                />
                {messageTooShort && (
                  <p style={{ fontSize: "0.8rem", color: "#c00", marginTop: "0.25rem" }}>10文字以上で入力してください</p>
                )}
              </div>

              <div className="form-group">
                <label htmlFor="name">お名前（任意）</label>
                <input id="name" type="text" value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} />
              </div>

              <div className="form-group">
                <label htmlFor="email">メールアドレス（任意・返信が必要な場合）</label>
                <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} style={inputStyle} />
              </div>

              {/* ハニーポット: 画面には表示しない */}
              <input type="text" name="website" tabIndex={-1} autoComplete="off" style={{ position: "absolute", left: "-9999px" }} aria-hidden="true" />

              {status === "error" && (
                <p style={{ color: "#c00", marginBottom: "0.5rem" }}>送信に失敗しました。しばらくしてから再試行してください。</p>
              )}
              {status === "not_configured" && (
                <p style={{ color: "#c00", marginBottom: "0.5rem" }}>
                  フォームは現在準備中です。お手数ですが時間をおいてお試しください。
                </p>
              )}
              <button type="submit" className="btn btn-primary" disabled={!canSubmit}>
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
