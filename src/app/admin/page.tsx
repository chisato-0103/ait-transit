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

interface DiaOverride {
  operation_date: string;
  dia_type: string;
  memo?: string;
  updated_at?: string;
}

const DIA_LABELS: Record<string, string> = {
  A: "Aダイヤ（授業期間平日）",
  B: "Bダイヤ（土曜）",
  C: "Cダイヤ（学校休業期間平日）",
  holiday: "運休日（全便なし）",
};

// JSTの今日。toISOString はUTC基準のため、+9時間してから日付部分を取る
function todayJst(): string {
  return new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

interface Overview {
  today: string;
  today_dia: string;
  today_dia_description: string;
  tomorrow_dia: string;
  tomorrow_dia_description: string;
  today_dia_base: string;
  tomorrow_dia_base: string;
  overrides_total: number;
  overrides_source: "local" | "github" | "fallback";
  overrides_fetched_at: string | null;
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
  const [maintenance, setMaintenance] = useState(false);
  const [maintenanceMsg, setMaintenanceMsg] = useState("");
  const [configResult, setConfigResult] = useState("");
  const [configSaving, setConfigSaving] = useState(false);
  const [dias, setDias] = useState<DiaOverride[]>([]);
  const [diaResult, setDiaResult] = useState("");
  const [diaSaving, setDiaSaving] = useState(false);

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
    api("/api/admin/dia-overrides").then(async (r) => {
      if (r.ok) setDias((await r.json()).data);
    });
    fetch("/api/site-config").then(async (r) => {
      if (r.ok) {
        const cfg = (await r.json()).data;
        setMaintenance(!!cfg.maintenance);
        setMaintenanceMsg(cfg.maintenance_message ?? "");
      }
    });
  }, [authed, api]);

  const saveConfig = async () => {
    setConfigSaving(true);
    setConfigResult("");
    try {
      const res = await api("/api/admin/site-config", {
        method: "PUT",
        body: JSON.stringify({ maintenance, maintenance_message: maintenanceMsg }),
      });
      const json = await res.json();
      setConfigResult(res.ok ? `✅ ${json.detail}` : `❌ 保存失敗: ${json.detail ?? json.error}`);
    } catch {
      setConfigResult("❌ 通信エラー");
    } finally {
      setConfigSaving(false);
    }
  };

  const refreshOverview = useCallback(async () => {
    const res = await api("/api/admin/overview");
    if (res.ok) setOverview((await res.json()).data);
  }, [api]);

  const updateDia = (index: number, patch: Partial<DiaOverride>) =>
    setDias((ds) => ds.map((d, i) => (i === index ? { ...d, ...patch } : d)));

  const addDia = () => setDias((ds) => [...ds, { operation_date: todayJst(), dia_type: "A", memo: "" }]);

  // 日付の未入力・重複があるまま保存させない（サーバー側も同じ条件で拒否する）
  const diaDates = dias.map((d) => d.operation_date);
  const diaInvalid = diaDates.some((d) => !d) || new Set(diaDates).size !== diaDates.length;

  const saveDias = async () => {
    setDiaSaving(true);
    setDiaResult("");
    try {
      const res = await api("/api/admin/dia-overrides", { method: "PUT", body: JSON.stringify(dias) });
      const json = await res.json();
      if (res.ok) {
        setDiaResult(`✅ ${json.detail}`);
        const reloaded = await api("/api/admin/dia-overrides");
        if (reloaded.ok) setDias((await reloaded.json()).data);
        await refreshOverview();
      } else {
        setDiaResult(`❌ 保存失敗: ${json.detail ?? json.error}`);
      }
    } catch {
      setDiaResult("❌ 通信エラー");
    } finally {
      setDiaSaving(false);
    }
  };

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
              <button type="submit" className="btn btn-primary" style={{ marginTop: "0.75rem" }}>ログイン</button>
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
                <tr><td style={{ padding: "0.3rem 0", color: "#666" }}>臨時ダイヤ</td><td>{overview.overrides_total}件 登録中</td></tr>
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

        <div className="search-area" style={{ padding: "1rem", marginBottom: "1rem" }}>
          <h2 style={{ fontSize: "1.05rem", marginBottom: "0.75rem" }}>🚨 シャトル臨時ダイヤ</h2>
          <p style={{ fontSize: "0.85rem", color: "#666", marginBottom: "0.75rem" }}>
            公式の運行カレンダーより優先されます。ダイヤが違っていた日をここで差し替えてください。利用者の画面に「臨時」とは表示されません。
          </p>
          {overview && (
            <div style={{ fontSize: "0.9rem", marginBottom: "0.75rem", padding: "0.5rem 0.75rem", background: "#f5f7fa", borderRadius: "6px" }}>
              <div>
                本日（{overview.today}）:{" "}
                {overview.today_dia_base !== overview.today_dia ? (
                  <><s style={{ color: "#999" }}>{overview.today_dia_base}</s> → <strong style={{ color: "#c00" }}>{overview.today_dia}（臨時）</strong></>
                ) : (
                  <>{overview.today_dia}ダイヤ</>
                )}
              </div>
              <div>
                明日:{" "}
                {overview.tomorrow_dia_base !== overview.tomorrow_dia ? (
                  <><s style={{ color: "#999" }}>{overview.tomorrow_dia_base}</s> → <strong style={{ color: "#c00" }}>{overview.tomorrow_dia}（臨時）</strong></>
                ) : (
                  <>{overview.tomorrow_dia}ダイヤ</>
                )}
              </div>
              <div style={{ marginTop: "0.25rem", fontSize: "0.8rem", color: overview.overrides_source === "fallback" ? "#c00" : "#666" }}>
                {overview.overrides_source === "fallback"
                  ? "⚠ 上書きデータを取得できず、ビルド時のデータで動作しています"
                  : `取得元: ${overview.overrides_source === "github" ? "GitHub（本番）" : "ローカルファイル"}`}
                {overview.overrides_fetched_at && ` / 最終取得 ${overview.overrides_fetched_at.slice(11, 19)}`}
              </div>
            </div>
          )}
          {dias.map((d, i) => (
            <div key={i} style={{ border: "1px solid #ddd", borderRadius: "8px", padding: "0.75rem", marginBottom: "0.75rem", opacity: d.operation_date && d.operation_date < todayJst() ? 0.55 : 1 }}>
              <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "0.5rem" }}>
                <input type="date" value={d.operation_date} onChange={(e) => updateDia(i, { operation_date: e.target.value })} style={{ ...inputStyle, width: "auto" }} />
                <select value={d.dia_type} onChange={(e) => updateDia(i, { dia_type: e.target.value })} style={{ ...inputStyle, width: "auto" }}>
                  {Object.entries(DIA_LABELS).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
                </select>
                <button type="button" onClick={() => setDias((ds) => ds.filter((_, x) => x !== i))}
                  style={{ marginLeft: "auto", border: "none", background: "none", color: "#c00", cursor: "pointer" }}>削除</button>
              </div>
              <input type="text" placeholder="メモ（管理用・利用者には表示されません）" value={d.memo ?? ""} maxLength={100}
                onChange={(e) => updateDia(i, { memo: e.target.value })} style={inputStyle} />
            </div>
          ))}
          <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
            <button type="button" className="btn" onClick={addDia} style={{ border: "1px solid var(--primary-color)", color: "var(--primary-color)", background: "none" }}>＋ 追加</button>
            <button type="button" className="btn btn-primary" onClick={saveDias} disabled={diaSaving || diaInvalid}>
              {diaSaving ? "保存中..." : "保存"}
            </button>
            {diaInvalid && <span style={{ fontSize: "0.85rem", color: "#c00" }}>日付が未入力か重複しています</span>}
            {diaResult && <span style={{ fontSize: "0.85rem" }}>{diaResult}</span>}
          </div>
        </div>

        <div className="search-area" style={{ padding: "1rem", marginBottom: "1rem" }}>
          <h2 style={{ fontSize: "1.05rem", marginBottom: "0.75rem" }}>🛠 メンテナンスモード</h2>
          <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.75rem" }}>
            <input type="checkbox" checked={maintenance} onChange={(e) => setMaintenance(e.target.checked)} />
            メンテナンス中にする（トップページの検索結果を停止して案内を表示）
          </label>
          {maintenance && (
            <textarea
              placeholder="表示するメッセージ（例: ダイヤ改正データの更新作業中です。今日中に復旧します）"
              value={maintenanceMsg}
              rows={2}
              onChange={(e) => setMaintenanceMsg(e.target.value)}
              style={{ ...inputStyle, resize: "vertical", marginBottom: "0.75rem" }}
            />
          )}
          <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap", marginTop: "0.5rem" }}>
            <button type="button" className="btn btn-primary" onClick={saveConfig} disabled={configSaving}>
              {configSaving ? "保存中..." : "保存"}
            </button>
            {configResult && <span style={{ fontSize: "0.85rem" }}>{configResult}</span>}
          </div>
        </div>

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
