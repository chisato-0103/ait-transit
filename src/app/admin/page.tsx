"use client";
import { useCallback, useEffect, useState } from "react";

interface Notice {
  id: number;
  date: string;
  title: string;
  body: string;
  type: "info" | "warning" | "alert";
  active: boolean;
}

interface Overview {
  today: string;
  today_dia: string;
  today_dia_description: string;
  tomorrow_dia: string;
  tomorrow_dia_description: string;
  datasets: {
    shuttle_bus: number;
    linimo: number;
    aichi_kanjo: number;
    schedule_days: number;
    schedule_until: string | null;
  };
  notices_total: number;
  notices_active: number;
  data_sources: Record<string, string>;
}

const TOKEN_KEY = "ait-transit:admin-token";

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "0.5rem",
  border: "1px solid #ddd",
  borderRadius: "6px",
  fontSize: "0.95rem",
};

export default function AdminPage() {
  const [token, setToken] = useState("");
  const [authed, setAuthed] = useState(false);
  const [authError, setAuthError] = useState("");
  const [overview, setOverview] = useState<Overview | null>(null);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [saveResult, setSaveResult] = useState("");
  const [saving, setSaving] = useState(false);

  const api = useCallback(
    async (path: string, init?: RequestInit) => {
      const t = token || sessionStorage.getItem(TOKEN_KEY) || "";
      return fetch(path, { ...init, headers: { ...init?.headers, "x-admin-token": t, "Content-Type": "application/json" } });
    },
    [token]
  );

  const login = useCallback(async (t: string) => {
    setAuthError("");
    const res = await fetch("/api/admin/overview", { headers: { "x-admin-token": t } });
    if (res.status === 503) { setAuthError("管理機能が無効です（ADMIN_PASSWORD 未設定）"); return; }
    if (!res.ok) { setAuthError("パスワードが違います"); return; }
    sessionStorage.setItem(TOKEN_KEY, t);
    setToken(t);
    setAuthed(true);
    setOverview((await res.json()).data);
  }, []);

  // セッション中の再訪は自動ログイン
  useEffect(() => {
    const saved = sessionStorage.getItem(TOKEN_KEY);
    if (saved) login(saved);
  }, [login]);

  useEffect(() => {
    if (!authed) return;
    api("/api/admin/notices").then(async (r) => {
      if (r.ok) setNotices((await r.json()).data);
    });
  }, [authed, api]);

  const update = (id: number, patch: Partial<Notice>) =>
    setNotices((ns) => ns.map((n) => (n.id === id ? { ...n, ...patch } : n)));

  const addNotice = () => {
    const nextId = Math.max(0, ...notices.map((n) => n.id)) + 1;
    const today = new Date().toISOString().slice(0, 10);
    setNotices((ns) => [...ns, { id: nextId, date: today, title: "", body: "", type: "info", active: true }]);
  };

  const save = async () => {
    setSaving(true);
    setSaveResult("");
    try {
      const res = await api("/api/admin/notices", { method: "PUT", body: JSON.stringify(notices) });
      const json = await res.json();
      setSaveResult(res.ok ? `✅ ${json.detail}` : `❌ 保存失敗: ${json.detail ?? json.error}`);
    } catch {
      setSaveResult("❌ 通信エラー");
    } finally {
      setSaving(false);
    }
  };

  if (!authed) {
    return (
      <div className="app">
        <header className="header"><h1>管理画面</h1><p>愛工大交通情報システム</p></header>
        <div className="container" style={{ maxWidth: "420px" }}>
          <div className="search-area" style={{ padding: "1.5rem" }}>
            <form onSubmit={(e) => { e.preventDefault(); login(token); }}>
              <div className="form-group">
                <label htmlFor="pw">管理者パスワード</label>
                <input id="pw" type="password" value={token} onChange={(e) => setToken(e.target.value)} style={inputStyle} autoFocus />
              </div>
              {authError && <p style={{ color: "#c00", fontSize: "0.9rem", marginBottom: "0.5rem" }}>{authError}</p>}
              <button type="submit" className="btn btn-primary">ログイン</button>
            </form>
          </div>
          <div style={{ marginTop: "1rem", textAlign: "center" }}><a href="/">← トップに戻る</a></div>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <header className="header"><h1>管理画面</h1><p>愛工大交通情報システム</p></header>
      <div className="container">
        {overview && (
          <div className="search-area" style={{ padding: "1rem", marginBottom: "1rem" }}>
            <h2 style={{ fontSize: "1.05rem", marginBottom: "0.75rem" }}>📊 ダッシュボード</h2>
            <table style={{ width: "100%", fontSize: "0.9rem", borderCollapse: "collapse" }}>
              <tbody>
                <tr><td style={{ padding: "0.3rem 0", color: "#666" }}>本日（{overview.today}）</td><td>{overview.today_dia}ダイヤ — {overview.today_dia_description}</td></tr>
                <tr><td style={{ padding: "0.3rem 0", color: "#666" }}>明日</td><td>{overview.tomorrow_dia}ダイヤ — {overview.tomorrow_dia_description}</td></tr>
                <tr><td style={{ padding: "0.3rem 0", color: "#666" }}>データ件数</td><td>シャトル {overview.datasets.shuttle_bus} / リニモ {overview.datasets.linimo} / 愛環 {overview.datasets.aichi_kanjo}</td></tr>
                <tr><td style={{ padding: "0.3rem 0", color: "#666" }}>運行カレンダー</td><td>{overview.datasets.schedule_days}日分（{overview.datasets.schedule_until} まで）</td></tr>
                <tr><td style={{ padding: "0.3rem 0", color: "#666" }}>お知らせ</td><td>{overview.notices_active}件 公開中（全{overview.notices_total}件）</td></tr>
              </tbody>
            </table>
            <details style={{ marginTop: "0.5rem", fontSize: "0.85rem", color: "#666" }}>
              <summary>データソース</summary>
              <ul style={{ paddingLeft: "1.2rem", marginTop: "0.3rem" }}>
                {Object.entries(overview.data_sources).map(([k, v]) => <li key={k}>{k}: {v}</li>)}
              </ul>
            </details>
          </div>
        )}

        <div className="search-area" style={{ padding: "1rem" }}>
          <h2 style={{ fontSize: "1.05rem", marginBottom: "0.75rem" }}>📢 お知らせ管理</h2>
          {notices.map((n) => (
            <div key={n.id} style={{ border: "1px solid #ddd", borderRadius: "8px", padding: "0.75rem", marginBottom: "0.75rem", opacity: n.active ? 1 : 0.55 }}>
              <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "0.5rem" }}>
                <input type="date" value={n.date} onChange={(e) => update(n.id, { date: e.target.value })} style={{ ...inputStyle, width: "auto" }} />
                <select value={n.type} onChange={(e) => update(n.id, { type: e.target.value as Notice["type"] })} style={{ ...inputStyle, width: "auto" }}>
                  <option value="info">info</option>
                  <option value="warning">warning</option>
                  <option value="alert">alert</option>
                </select>
                <label style={{ display: "flex", alignItems: "center", gap: "0.3rem", fontSize: "0.9rem" }}>
                  <input type="checkbox" checked={n.active} onChange={(e) => update(n.id, { active: e.target.checked })} /> 公開
                </label>
                <button type="button" onClick={() => setNotices((ns) => ns.filter((x) => x.id !== n.id))}
                  style={{ marginLeft: "auto", border: "none", background: "none", color: "#c00", cursor: "pointer" }}>削除</button>
              </div>
              <input type="text" placeholder="タイトル" value={n.title} onChange={(e) => update(n.id, { title: e.target.value })} style={{ ...inputStyle, marginBottom: "0.5rem" }} />
              <textarea placeholder="本文" value={n.body} rows={3} onChange={(e) => update(n.id, { body: e.target.value })} style={{ ...inputStyle, resize: "vertical" }} />
            </div>
          ))}
          <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
            <button type="button" className="btn" onClick={addNotice} style={{ border: "1px solid var(--primary-color)", color: "var(--primary-color)", background: "none" }}>＋ 追加</button>
            <button type="button" className="btn btn-primary" onClick={save} disabled={saving || notices.some((n) => !n.title.trim())}>
              {saving ? "保存中..." : "保存"}
            </button>
            {saveResult && <span style={{ fontSize: "0.85rem" }}>{saveResult}</span>}
          </div>
        </div>

        <div style={{ marginTop: "1rem", textAlign: "center" }}><a href="/">← トップに戻る</a></div>
      </div>
    </div>
  );
}
