"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";

// ============================================================
// 型定義
// ============================================================

interface Station {
  station_code: string;
  station_name: string;
  line_type: string | null;
  order_index: number;
}

interface Notice {
  id: number;
  date: string;
  title: string;
  body: string;
  type: "info" | "warning" | "alert";
  active: boolean;
}

interface LinimoOption {
  linimo_departure: string;
  destination_arrival: string;
  transfer_time: number;
  total_time: number;
}

interface ShuttleOption {
  shuttle_departure: string;
  shuttle_arrival: string;
  transfer_time: number;
  total_time: number;
}

interface RouteResult {
  shuttle_departure?: string;
  shuttle_arrival?: string;
  linimo_departure?: string | null;
  linimo_arrival?: string | null;
  destination_arrival?: string;
  transfer_time?: number;
  total_time: number;
  waiting_time: number;
  destination_name?: string;
  origin_name?: string;
  linimo_time?: number;
  linimo_options?: LinimoOption[];
  shuttle_options?: ShuttleOption[];
}

interface ServiceInfo {
  type: string;
  direction_text: string;
  last: string | null;
  first: string | null;
  next_day_first: string | null;
  next_day_dia_type: string;
  next_day_dia_description: string;
  is_before_service: boolean;
  is_after_service: boolean;
  bg_color: string;
  text_color: string;
}

interface ApiData {
  current_time: string;
  dia_type: string;
  dia_description: string;
  day_type: string;
  day_description: string;
  direction: string;
  line_code: string;
  from_name: string;
  to_name: string;
  routes: RouteResult[];
  service_info: ServiceInfo | null;
  extra_shuttle_notice?: boolean;
  last_shuttle?: string | null;
  last_shuttle_label?: string;
}

type RouteOption = "to_linimo" | "from_linimo" | "to_aichi_kanjo" | "from_aichi_kanjo";

// 前回の検索条件（路線と駅）の保存キー。方向は開いた時間帯から自動決定する
const LAST_SEARCH_KEY = "ait-transit:last-search";

// ============================================================
// ユーティリティ
// ============================================================

function fmt(t: string | null | undefined): string {
  if (!t) return "";
  return t.length > 5 ? t.slice(0, 5) : t;
}

function useCountdown(departureTime: string): { text: string; urgent: boolean } {
  const [state, setState] = useState({ text: "", urgent: false });
  useEffect(() => {
    const update = () => {
      if (!departureTime) return;
      const now = new Date();
      const [h, m] = departureTime.split(":").map(Number);
      const dep = new Date();
      dep.setHours(h, m, 0, 0);
      const diff = Math.floor((dep.getTime() - now.getTime()) / 1000);
      if (diff <= 0) {
        setState({ text: "出発しました", urgent: true });
        return;
      }
      const min = Math.floor(diff / 60);
      const sec = diff % 60;
      setState({ text: `あと ${min}分${sec}秒`, urgent: min < 5 });
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [departureTime]);
  return state;
}

// ============================================================
// メインコンポーネント
// ============================================================

export default function MainClient() {
  const searchParams = useSearchParams();

  const [currentTime, setCurrentTime] = useState("");
  const [stations, setStations] = useState<Station[]>([]);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [apiData, setApiData] = useState<ApiData | null>(null);
  const [loading, setLoading] = useState(true);
  const [routeOption, setRouteOption] = useState<RouteOption>("to_linimo");
  const [destination, setDestination] = useState("fujigaoka");
  const [origin, setOrigin] = useState("fujigaoka");
  const [searchOpen, setSearchOpen] = useState(false);
  const [disclaimerOpen, setDisclaimerOpen] = useState(false);
  // 検索基準: now=現在時刻のライブ表示 / departure=指定日時に出発 / arrival=指定日時までに到着
  const [searchMode, setSearchMode] = useState<"now" | "departure" | "arrival">("now");
  const [simDraft, setSimDraft] = useState(() => {
    const d = new Date();
    return {
      date: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`,
      time: "08:00",
    };
  });

  // サイト設定（メンテナンスモード）
  const [siteConfig, setSiteConfig] = useState<{ maintenance: boolean; maintenance_message: string } | null>(null);
  useEffect(() => {
    fetch("/api/site-config")
      .then((r) => r.json())
      .then((j) => setSiteConfig(j.data))
      .catch(() => {});
  }, []);
  const inMaintenance = !!siteConfig?.maintenance;

  // 非公式警告は初回訪問時のみ全文表示し、以降は1行に畳む
  useEffect(() => {
    try {
      if (!localStorage.getItem("ait-transit:disclaimer-seen")) {
        setDisclaimerOpen(true);
        localStorage.setItem("ait-transit:disclaimer-seen", "1");
      }
    } catch {
      setDisclaimerOpen(true);
    }
  }, []);
  const [noticesOpen, setNoticesOpen] = useState(false);
  const [nextDepExpanded, setNextDepExpanded] = useState(false);

  // PWA: Service Worker登録（本番のみ。devではHMRとキャッシュが衝突する）
  useEffect(() => {
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // 登録失敗してもアプリ動作には影響しない
      });
    }
  }, []);

  // 現在時刻
  useEffect(() => {
    const update = () => {
      const now = new Date();
      setCurrentTime(
        `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}:${String(now.getSeconds()).padStart(2, "0")}`
      );
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, []);

  // 駅一覧
  useEffect(() => {
    fetch("/api/stations")
      .then((r) => r.json())
      .then((json) => setStations(json.data ?? []));
  }, []);

  // お知らせ
  useEffect(() => {
    fetch("/api/notices")
      .then((r) => r.json())
      .then((json) => {
        const data = json.data ?? [];
        setNotices(data);
        if (data.length > 0) setNoticesOpen(true);
      });
  }, []);

  // 前回の検索条件＋時間帯で初期化（午前=大学行き / 午後=帰宅方向）。
  // URLパラメータがある場合は後続のeffectが上書きする
  useEffect(() => {
    if (searchParams.get("direction") || searchParams.get("destination") || searchParams.get("origin")) return;
    let saved: { line?: string; station?: string } = {};
    try {
      saved = JSON.parse(localStorage.getItem(LAST_SEARCH_KEY) ?? "{}");
    } catch {
      // 保存データ破損時はデフォルトのまま
    }
    const line = saved.line === "aichi_kanjo" ? "aichi_kanjo" : "linimo";
    const morning = new Date().getHours() < 12;
    setRouteOption(
      line === "linimo"
        ? (morning ? "from_linimo" : "to_linimo")
        : (morning ? "from_aichi_kanjo" : "to_aichi_kanjo")
    );
    if (saved.station) {
      setDestination(saved.station);
      setOrigin(saved.station);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 検索条件が変わったら保存（次回起動時の初期値になる）
  useEffect(() => {
    const line = routeOption.includes("aichi") ? "aichi_kanjo" : "linimo";
    const isToSt = routeOption === "to_linimo" || routeOption === "to_aichi_kanjo";
    try {
      localStorage.setItem(LAST_SEARCH_KEY, JSON.stringify({ line, station: isToSt ? destination : origin }));
    } catch {
      // プライベートモード等で保存できなくても動作に支障なし
    }
  }, [routeOption, destination, origin]);

  // URLパラメータから初期値
  useEffect(() => {
    const dir = searchParams.get("direction");
    const lc = searchParams.get("line_code");
    const dst = searchParams.get("destination");
    const org = searchParams.get("origin");
    if (dir === "to_station" && lc === "linimo") setRouteOption("to_linimo");
    else if (dir === "to_university" && lc === "linimo") setRouteOption("from_linimo");
    else if (dir === "to_station" && lc === "aichi_kanjo") setRouteOption("to_aichi_kanjo");
    else if (dir === "to_university" && lc === "aichi_kanjo") setRouteOption("from_aichi_kanjo");
    if (dst) setDestination(dst);
    if (org) setOrigin(org);
  }, [searchParams]);

  // 直前のリクエストを中断して、古い応答が新しい検索結果を上書きするのを防ぐ
  const fetchAbortRef = useRef<AbortController | null>(null);

  const fetchRoutes = useCallback(async () => {
    fetchAbortRef.current?.abort();
    const ctrl = new AbortController();
    fetchAbortRef.current = ctrl;
    setLoading(true);
    const direction = routeOption === "from_linimo" || routeOption === "from_aichi_kanjo" ? "to_university" : "to_station";
    const lineCode = routeOption.includes("aichi") ? "aichi_kanjo" : "linimo";
    const params = new URLSearchParams({ direction, line_code: lineCode });
    if (direction === "to_station") params.set("destination", destination);
    else params.set("origin", origin);
    const testDate = searchParams.get("test_date");
    const testTime = searchParams.get("test_time");
    if (testDate) params.set("test_date", testDate);
    if (testTime) params.set("test_time", testTime);
    // 日時指定検索はURLのテストパラメータより優先
    if (searchMode !== "now" && simDraft.date && simDraft.time) {
      params.set("test_date", simDraft.date);
      params.set("test_time", `${simDraft.time}:00`);
      if (searchMode === "arrival") params.set("search_mode", "arrival");
    }
    try {
      const res = await fetch(`/api/next-connection?${params}`, { signal: ctrl.signal });
      const json = await res.json();
      if (!ctrl.signal.aborted && json.success) setApiData(json.data);
    } catch {
      // 中断・通信エラー時は表示を維持する
    } finally {
      if (!ctrl.signal.aborted) setLoading(false);
    }
  }, [routeOption, destination, origin, searchParams, searchMode, simDraft]);

  useEffect(() => {
    fetchRoutes();
    // 日時指定モードでは結果が変わらないので自動更新しない
    if (searchMode !== "now") return;
    const id = setInterval(fetchRoutes, 30000);
    return () => clearInterval(id);
  }, [fetchRoutes, searchMode]);

  const isToStation = routeOption === "to_linimo" || routeOption === "to_aichi_kanjo";
  const isLinimo = routeOption === "to_linimo" || routeOption === "from_linimo";
  const stationList = stations
    .filter((s) =>
      isLinimo
        ? s.line_type === "linimo" || s.station_code === "yakusa"
        : s.line_type === "aichi_kanjo" || s.station_code === "yakusa"
    )
    .sort((a, b) => a.order_index - b.order_index);

  const lineCode = apiData?.line_code ?? (routeOption.includes("aichi") ? "aichi_kanjo" : "linimo");
  const direction = apiData?.direction ?? (isToStation ? "to_station" : "to_university");
  const primaryRoute = apiData?.routes[0];
  const otherRoutes = apiData?.routes.slice(1) ?? [];

  // カウントダウン用の出発時刻
  let countdownTime = "";
  if (primaryRoute) {
    if (direction === "to_station") {
      countdownTime = fmt(primaryRoute.shuttle_departure);
    } else {
      countdownTime = primaryRoute.origin_name === "八草駅"
        ? fmt(primaryRoute.shuttle_departure)
        : fmt(primaryRoute.linimo_departure);
    }
  }

  // 出発時刻を過ぎたら自動で次の便に切り替える（30秒ポーリングを待たない）
  useEffect(() => {
    if (!countdownTime || searchMode !== "now") return;
    const [h, m] = countdownTime.split(":").map(Number);
    const dep = new Date();
    dep.setHours(h, m, 0, 0);
    const delay = dep.getTime() - Date.now() + 3000;
    if (delay <= 0 || delay > 60 * 60 * 1000) return;
    const id = setTimeout(fetchRoutes, delay);
    return () => clearTimeout(id);
  }, [countdownTime, fetchRoutes, searchMode]);

  return (
    <div>
      <header className="header">
        <h1>愛工大交通情報システム</h1>
        <p>シャトルバス＆リニモ乗り継ぎ案内</p>
      </header>

      <div className="container">
        {/* 非公式警告（初回のみ全文、以降は1行） */}
        <div className="alert-banner" onClick={() => setDisclaimerOpen((v) => !v)} style={{ cursor: "pointer" }}>
          <strong>⚠️ 本システムは非公式です{!disclaimerOpen && "（タップで詳細）"}</strong>
          {disclaimerOpen && (
            <p>
              このシステムは愛知工業大学の学生による非公式サービスです。
              実際にご利用になられる際は、必ず
              <a href="https://www.linimo.jp/" target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>リニモ公式サイト</a>や
              シャトルバスの公式情報でご確認ください。
            </p>
          )}
        </div>

        {/* 現在時刻 */}
        <div className="current-time-wrapper">
          <div className="current-time-label">⏰ 現在時刻</div>
          <div className="current-time">{currentTime || "読み込み中..."}</div>
          {apiData?.last_shuttle && (
            <div className="last-bus-chip">
              <Image src="/bus.svg" alt="" width={18} height={12} style={{ verticalAlign: "-1px", marginRight: "4px" }} />
              本日の終バス（{apiData.last_shuttle_label}） {apiData.last_shuttle}
            </div>
          )}
        </div>

        {/* ルート検索（折りたたみ） */}
        <section className="search-area collapsible">
          <div className="collapsible-header" onClick={() => setSearchOpen((v) => !v)}>
            <span>📍 ルート検索</span>
            <span className="collapsible-icon" style={{ transform: searchOpen ? "rotate(180deg)" : "none", transition: "transform 0.3s ease" }}>▼</span>
          </div>
          {searchOpen && (
            <div className="collapsible-content-inner">
            <div className="search-form">
              <div className="form-group">
                <label>路線と方向を選択</label>
                <div className="route-selection">
                  {([
                    ["to_linimo",       <><Image src="/school-dark.svg" alt="" width={20} height={13} /> 大学 → <Image src="/train-dark.svg" alt="" width={20} height={13} /> リニモ駅</> ],
                    ["from_linimo",     <><Image src="/train-dark.svg"  alt="" width={20} height={13} /> リニモ駅 → <Image src="/school-dark.svg" alt="" width={20} height={13} /> 大学</> ],
                    ["to_aichi_kanjo",  <><Image src="/school-dark.svg" alt="" width={20} height={13} /> 大学 → <Image src="/train-dark.svg"  alt="" width={20} height={13} /> 愛知環状線駅</> ],
                    ["from_aichi_kanjo",<><Image src="/train-dark.svg"  alt="" width={20} height={13} /> 愛知環状線駅 → <Image src="/school-dark.svg" alt="" width={20} height={13} /> 大学</> ],
                  ] as [RouteOption, React.ReactNode][]).map(([val, label]) => (
                    <label key={val} className="radio-option">
                      <input
                        type="radio"
                        name="route_option"
                        value={val}
                        checked={routeOption === val}
                        onChange={() => setRouteOption(val)}
                      />
                      <span className="radio-label">{label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {isToStation ? (
                <div className="form-group">
                  <label htmlFor="destination">目的地を選択</label>
                  <select id="destination" value={destination} onChange={(e) => setDestination(e.target.value)}>
                    {stationList.map((s) => (
                      <option key={s.station_code} value={s.station_code}>{s.station_name}</option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="form-group">
                  <label htmlFor="origin">出発地を選択</label>
                  <select id="origin" value={origin} onChange={(e) => setOrigin(e.target.value)}>
                    {stationList.map((s) => (
                      <option key={s.station_code} value={s.station_code}>{s.station_name}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="form-group">
                <label>検索基準</label>
                <div className="mode-segment">
                  {([["now", "今すぐ"], ["departure", "出発時刻"], ["arrival", "到着時刻"]] as const).map(([v, l]) => (
                    <button
                      key={v}
                      type="button"
                      className={`mode-segment-btn ${searchMode === v ? "active" : ""}`}
                      onClick={() => setSearchMode(v)}
                    >
                      {l}
                    </button>
                  ))}
                </div>
                {searchMode !== "now" && (
                  <div className="sim-datetime-row" style={{ marginTop: "0.5rem" }}>
                    <input
                      type="date"
                      value={simDraft.date}
                      onChange={(e) => setSimDraft((p) => ({ ...p, date: e.target.value }))}
                    />
                    <input
                      type="time"
                      value={simDraft.time}
                      onChange={(e) => setSimDraft((p) => ({ ...p, time: e.target.value }))}
                    />
                    <span style={{ fontSize: "0.85rem", color: "#666" }}>
                      {searchMode === "departure" ? "に出発" : "までに到着"}
                    </span>
                  </div>
                )}
              </div>
            </div>
            </div>
          )}
        </section>

        {/* 日時指定モードのバナー */}
        {searchMode !== "now" && (
          <div className="sim-banner">
            <span>
              {searchMode === "departure"
                ? `📅 ${simDraft.date.replaceAll("-", "/")} ${simDraft.time} 出発基準の検索結果`
                : `🎯 ${simDraft.date.replaceAll("-", "/")} ${simDraft.time} までに到着する便（遅い順）`}
            </span>
            <button type="button" onClick={() => setSearchMode("now")}>今に戻る</button>
          </div>
        )}

        {/* 次の便（メンテナンス中は案内に差し替え） */}
        {inMaintenance ? (
          <div className="no-service-card">
            <strong>🛠 メンテナンス中です</strong>
            <p>{siteConfig?.maintenance_message || "データ更新作業のため一時的に検索を停止しています。"}</p>
            <p style={{ fontSize: "0.85rem", opacity: 0.85 }}>
              お急ぎの場合は <a href="https://www.linimo.jp/" target="_blank" rel="noopener noreferrer" style={{ color: "#fff" }}>リニモ公式サイト</a> 等をご確認ください
            </p>
          </div>
        ) : loading ? (
          <div className="next-departure" style={{ textAlign: "center" }}>
            <div style={{ padding: "1rem" }}>読み込み中...</div>
          </div>
        ) : apiData && primaryRoute ? (
          <>
            <NextDeparture
              route={primaryRoute}
              direction={direction}
              lineCode={lineCode}
              fromName={apiData.from_name}
              toName={apiData.to_name}
              countdownTime={searchMode !== "now" ? "" : countdownTime}
              titleOverride={searchMode === "arrival" ? "間に合う最終の便" : undefined}
              countdownFallback={
                searchMode === "arrival"
                  ? `${fmt(direction === "to_station" ? primaryRoute.destination_arrival : primaryRoute.shuttle_arrival)} 着`
                  : undefined
              }
              expanded={nextDepExpanded}
              onToggle={() => setNextDepExpanded((v) => !v)}
            />
            {otherRoutes.length > 0 && (
              <section className="results">
                {otherRoutes.map((route, i) => (
                  <OtherRouteCard
                    key={i}
                    index={i + 2}
                    route={route}
                    direction={direction}
                    lineCode={lineCode}
                  />
                ))}
              </section>
            )}
          </>
        ) : apiData && apiData.service_info ? (
          <NoServiceCard info={apiData.service_info} diaDescription={apiData.dia_description} />
        ) : null}

        {/* 臨時シャトルバス案内（A・Bダイヤ 7:55〜10:45） */}
        {!inMaintenance && apiData?.extra_shuttle_notice && (
          <div className="extra-shuttle-notice">
            🚌 この時間帯（7:55〜10:45）は上記時刻表のほかに臨時シャトルバスも往復運行しています
          </div>
        )}

        {/* お知らせ（折りたたみ） */}
        {notices.length > 0 && (
          <section className="notices collapsible">
            <div className="collapsible-header" onClick={() => setNoticesOpen((v) => !v)}>
              <span>📢 お知らせ</span>
              <span className="collapsible-icon" style={{ transform: noticesOpen ? "rotate(180deg)" : "none", transition: "transform 0.3s ease" }}>▼</span>
            </div>
            {noticesOpen && (
              <div className="collapsible-content-inner">
              {notices.map((n) => (
                <div
                  key={n.id}
                  className={`notice-item ${n.type === "warning" ? "warning" : n.type === "alert" ? "danger" : ""}`}
                >
                  <div className="notice-title">{n.title}</div>
                  <div className="notice-date">{n.date}</div>
                  <div className="notice-content">{n.body}</div>
                </div>
              ))}
              </div>
            )}
          </section>
        )}
      </div>

      {/* ダイヤ情報 */}
      {apiData && (
        <div className="dia-info">
          <span>本日のダイヤ: {apiData.dia_description}</span>
          {apiData.day_description && <span> / {apiData.day_description}</span>}
        </div>
      )}

      {/* フッター */}
      <footer className="footer">
        <p>&copy; 2025 愛知工業大学 交通情報システム</p>
        <p style={{ fontSize: "0.85em", marginTop: "8px" }}>
          <strong>免責事項：</strong>本システムは愛知工業大学の学生向け通学支援を目的とした非営利の情報提供サービスです。<br />
          時刻表データは公開情報を参考にしていますが、実際の運行状況と異なる場合があります。<br />
          正確な時刻は<a href="https://www.linimo.jp/" target="_blank" rel="noopener noreferrer">リニモ公式サイト</a>でご確認ください。
        </p>
        <p style={{ fontSize: "0.8em", marginTop: "12px" }}>
          <a href="/contact">お問い合わせ</a>
        </p>
      </footer>
    </div>
  );
}

// ============================================================
// 次の便（大型カード）
// ============================================================

function NextDeparture({
  route,
  direction,
  lineCode,
  fromName,
  toName,
  countdownTime,
  expanded,
  onToggle,
  titleOverride,
  countdownFallback,
}: {
  route: RouteResult;
  direction: string;
  lineCode: string;
  fromName: string;
  toName: string;
  countdownTime: string;
  expanded: boolean;
  onToggle: () => void;
  titleOverride?: string;
  countdownFallback?: string;
}) {
  const countdown = useCountdown(countdownTime);
  const [selectedLinimo, setSelectedLinimo] = useState(0);
  const [selectedShuttle, setSelectedShuttle] = useState(0);

  const isToStation = direction === "to_station";
  const railName = lineCode === "aichi_kanjo" ? "電車" : "リニモ";
  const isYakusaDest = route.destination_name === "八草";
  const isYakusaOrigin = route.origin_name === "八草駅";

  let title = "";
  let departureTime = "";
  let routeInfo: React.ReactNode = null;

  if (isToStation) {
    departureTime = fmt(route.shuttle_departure);
    title = "次に乗るシャトルバス";
    if (isYakusaDest) {
      routeInfo = (
        <>
          <span className="ri-seg"><Image src="/school.svg" alt="" width={22} height={14} />愛知工業大学</span>
          <span className="ri-arrow">→</span>
          <span className="ri-seg"><Image src="/bus.svg" alt="" width={22} height={14} />八草駅</span>
        </>
      );
    } else {
      routeInfo = (
        <>
          <span className="ri-seg"><Image src="/school.svg" alt="" width={22} height={14} />愛知工業大学</span>
          <span className="ri-arrow">→</span>
          <span className="ri-seg"><Image src="/bus.svg" alt="" width={22} height={14} />八草駅</span>
          <span className="ri-arrow">→</span>
          <span className="ri-seg"><Image src="/train.svg" alt="" width={22} height={14} />{route.destination_name}</span>
        </>
      );
    }
  } else if (isYakusaOrigin) {
    departureTime = fmt(route.shuttle_departure);
    title = "次に乗るシャトルバス";
    routeInfo = (
      <>
        <span className="ri-seg"><Image src="/bus.svg" alt="" width={22} height={14} />八草駅</span>
        <span className="ri-arrow">→</span>
        <span className="ri-seg"><Image src="/school.svg" alt="" width={22} height={14} />愛知工業大学</span>
      </>
    );
  } else {
    departureTime = fmt(route.linimo_departure);
    title = `次の${railName}は`;
    routeInfo = (
      <>
        <span className="ri-seg"><Image src="/train.svg" alt="" width={22} height={14} />{route.origin_name}</span>
        <span className="ri-arrow">→</span>
        <span className="ri-seg"><Image src="/bus.svg" alt="" width={22} height={14} />八草駅</span>
        <span className="ri-arrow">→</span>
        <span className="ri-seg"><Image src="/school.svg" alt="" width={22} height={14} />愛知工業大学</span>
      </>
    );
  }

  // 選択中オプション
  const linimoOpts = route.linimo_options ?? [];
  const shuttleOpts = route.shuttle_options ?? [];
  const activeLinimoOpt = linimoOpts[selectedLinimo] ?? linimoOpts[0];
  const activeShuttleOpt = shuttleOpts[selectedShuttle] ?? shuttleOpts[0];

  const effectiveDestArrival = activeLinimoOpt ? fmt(activeLinimoOpt.destination_arrival) : fmt(route.destination_arrival);
  const effectiveShuttleArrival = activeShuttleOpt ? fmt(activeShuttleOpt.shuttle_arrival) : fmt(route.shuttle_arrival);
  const effectiveTransfer = activeLinimoOpt?.transfer_time ?? activeShuttleOpt?.transfer_time ?? route.transfer_time ?? 0;
  const effectiveTotal = activeLinimoOpt?.total_time ?? activeShuttleOpt?.total_time ?? route.total_time;

  return (
    <div
      className={`next-departure ${expanded ? "expanded" : ""}`}
      onClick={(e) => {
        if ((e.target as HTMLElement).tagName === "INPUT") return;
        onToggle();
      }}
    >
      <div className="next-departure-title">{titleOverride ?? title}</div>
      <div className="next-departure-time">{departureTime} 発</div>
      <div className="next-departure-info">{routeInfo}</div>
      <div style={{ textAlign: "center" }}>
        <span className={`countdown ${countdown.urgent ? "urgent" : ""}`}>
          {countdown.text || countdownFallback || `あと ${route.waiting_time}分`}
        </span>
      </div>
      <div className="expand-hint">タップで詳細を表示 ▼</div>

      <div className="next-departure-details">
        <div style={{ marginTop: "1rem", paddingTop: "1rem", borderTop: "1px solid rgba(255,255,255,0.3)" }}>
          <RouteSteps
            route={route}
            direction={direction}
            lineCode={lineCode}
            isDark={true}
            selectedLinimo={selectedLinimo}
            selectedShuttle={selectedShuttle}
            onSelectLinimo={setSelectedLinimo}
            onSelectShuttle={setSelectedShuttle}
            effectiveDestArrival={effectiveDestArrival}
            effectiveShuttleArrival={effectiveShuttleArrival}
          />
          <div className="route-summary">
            <div className="summary-item">
              <span className="summary-label">待ち時間</span>
              <span className="summary-value" style={{ color: "white" }}>{route.waiting_time}分</span>
            </div>
            <div className="summary-item">
              <span className="summary-label">乗り換え</span>
              <span className="summary-value" style={{ color: "white" }}>{effectiveTransfer}分</span>
            </div>
            <div className="summary-item">
              <span className="summary-label">総所要時間</span>
              <span className="summary-value" style={{ color: "white" }}>{effectiveTotal}分</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// その他のルート（コンパクトカード）
// ============================================================

function OtherRouteCard({
  index,
  route,
  direction,
  lineCode,
}: {
  index: number;
  route: RouteResult;
  direction: string;
  lineCode: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const [selectedLinimo, setSelectedLinimo] = useState(0);
  const [selectedShuttle, setSelectedShuttle] = useState(0);

  const linimoOpts = route.linimo_options ?? [];
  const shuttleOpts = route.shuttle_options ?? [];
  const activeLinimoOpt = linimoOpts[selectedLinimo] ?? linimoOpts[0];
  const activeShuttleOpt = shuttleOpts[selectedShuttle] ?? shuttleOpts[0];

  const effectiveDestArrival = activeLinimoOpt ? fmt(activeLinimoOpt.destination_arrival) : fmt(route.destination_arrival);
  const effectiveShuttleArrival = activeShuttleOpt ? fmt(activeShuttleOpt.shuttle_arrival) : fmt(route.shuttle_arrival);
  const effectiveTransfer = activeLinimoOpt?.transfer_time ?? activeShuttleOpt?.transfer_time ?? route.transfer_time ?? 0;
  const effectiveTotal = activeLinimoOpt?.total_time ?? activeShuttleOpt?.total_time ?? route.total_time;

  const isToStation = direction === "to_station";
  const quickTime = isToStation
    ? fmt(route.shuttle_departure)
    : route.origin_name === "八草駅"
    ? fmt(route.shuttle_departure)
    : fmt(route.linimo_departure);

  return (
    <div
      className={`route-card-compact ${expanded ? "expanded" : ""}`}
      onClick={(e) => {
        if ((e.target as HTMLElement).tagName === "INPUT") return;
        setExpanded((v) => !v);
      }}
    >
      <div className="route-card-header">
        <span className="route-number">ルート {index}</span>
        <span className="route-total-time">{effectiveTotal}分</span>
      </div>
      <div className="route-quick-info">
        <span className="route-quick-time">{quickTime} 発</span>
        <span className="expand-icon">▼</span>
      </div>

      <div className="route-card-details">
        <div style={{ marginTop: "0.75rem", paddingTop: "0.75rem", borderTop: "1px solid #eee" }}>
          <RouteSteps
            route={route}
            direction={direction}
            lineCode={lineCode}
            isDark={false}
            selectedLinimo={selectedLinimo}
            selectedShuttle={selectedShuttle}
            onSelectLinimo={setSelectedLinimo}
            onSelectShuttle={setSelectedShuttle}
            effectiveDestArrival={effectiveDestArrival}
            effectiveShuttleArrival={effectiveShuttleArrival}
          />
          <div className="route-summary">
            <div className="summary-item">
              <span className="summary-label">待ち時間</span>
              <span className="summary-value">{route.waiting_time}分</span>
            </div>
            <div className="summary-item">
              <span className="summary-label">乗り換え</span>
              <span className="summary-value">{effectiveTransfer}分</span>
            </div>
            <div className="summary-item">
              <span className="summary-label">総所要時間</span>
              <span className="summary-value">{effectiveTotal}分</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// ルートステップ（共通）
// ============================================================

function RouteSteps({
  route,
  direction,
  lineCode,
  isDark,
  selectedLinimo,
  selectedShuttle,
  onSelectLinimo,
  onSelectShuttle,
  effectiveDestArrival,
  effectiveShuttleArrival,
}: {
  route: RouteResult;
  direction: string;
  lineCode: string;
  isDark: boolean;
  selectedLinimo: number;
  selectedShuttle: number;
  onSelectLinimo: (i: number) => void;
  onSelectShuttle: (i: number) => void;
  effectiveDestArrival: string;
  effectiveShuttleArrival: string;
}) {
  const isToStation = direction === "to_station";
  const isYakusaDest = route.destination_name === "八草";
  const isYakusaOrigin = route.origin_name === "八草駅";
  const railName = lineCode === "aichi_kanjo" ? "電車" : "リニモ";
  const arrowColor = isDark ? "white" : undefined;
  const stepsColor = isDark ? "white" : undefined;
  const busIcon = isDark ? "/bus.svg" : "/bus-dark.svg";
  const schoolIcon = isDark ? "/school.svg" : "/school-dark.svg";
  const trainIcon = isDark ? "/train.svg" : "/train-dark.svg";

  const linimoOpts = route.linimo_options ?? [];
  const shuttleOpts = route.shuttle_options ?? [];

  if (isToStation) {
    return (
      <div className="route-steps" style={{ color: stepsColor }}>
        {/* 大学 発 */}
        <div className="route-step">
          <Image src={schoolIcon} alt="大学" width={50} height={30} />
          <div className="route-step-content">
            <div className="route-step-time">愛知工業大学 発 {fmt(route.shuttle_departure)}</div>
            <div className="route-step-detail">シャトルバスで出発</div>
          </div>
        </div>

        {isYakusaDest ? (
          <>
            <div className="route-arrow" style={{ color: arrowColor }}>↓</div>
            <div className="route-step">
              <Image src={busIcon} alt="バス" width={50} height={30} />
              <div className="route-step-content">
                <div className="route-step-time">八草駅 着 {fmt(route.shuttle_arrival)}</div>
                <div className="route-step-detail">到着</div>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="route-arrow" style={{ color: arrowColor }}>↓</div>
            <div className="route-step">
              <Image src={busIcon} alt="バス" width={50} height={30} />
              <div className="route-step-content">
                <div className="route-step-time">八草駅 着 {fmt(route.shuttle_arrival)}</div>
                <div className="route-step-detail">シャトルバス約5分</div>
              </div>
            </div>

            {linimoOpts.length > 0 && (
              <>
                <div className="route-arrow" style={{ color: arrowColor }}>↓</div>
                <div className="route-step">
                  <Image src={trainIcon} alt="時計" width={50} height={30} />
                  <div className="route-step-content">
                    <div className="route-step-time">乗り換え時間: {linimoOpts[selectedLinimo]?.transfer_time ?? route.transfer_time}分</div>
                    <div className="route-step-detail">{railName}へ乗り換え</div>
                  </div>
                </div>

                <div className="route-arrow" style={{ color: arrowColor }}>↓</div>
                <div style={{ margin: "0.5rem 0" }}>
                  <div className="segment-select-label" style={{ color: isDark ? "rgba(255,255,255,0.7)" : "#555" }}>
                    乗り換え後の{railName}を選択
                  </div>
                  <div className={`segment-container ${isDark ? "" : "light"}`}>
                    {linimoOpts.map((opt, i) => (
                      <label key={i} className="segment-label" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="radio"
                          name={`linimo_${route.shuttle_departure}_${isDark}`}
                          checked={selectedLinimo === i}
                          onChange={() => onSelectLinimo(i)}
                          style={{ display: "none" }}
                        />
                        <div className={`segment-button ${selectedLinimo === i ? (isDark ? "selected-dark" : "selected-light") : ""}`}>
                          <div className={`segment-time ${!isDark ? (selectedLinimo === i ? "light-text" : "unselected") : ""}`}>
                            {fmt(opt.linimo_departure)}
                          </div>
                          <div className={`segment-arrival ${!isDark ? (selectedLinimo === i ? "light-text" : "unselected") : ""}`}>
                            着{fmt(opt.destination_arrival)}
                          </div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="route-arrow" style={{ color: arrowColor }}>↓</div>
                <div className="route-step">
                  <Image src={busIcon} alt="到着" width={50} height={30} />
                  <div className="route-step-content">
                    <div className="route-step-time">{route.destination_name} 着 {effectiveDestArrival}</div>
                    <div className="route-step-detail">到着</div>
                  </div>
                </div>
              </>
            )}
          </>
        )}
      </div>
    );
  }

  // 大学方面
  if (isYakusaOrigin) {
    return (
      <div className="route-steps" style={{ color: stepsColor }}>
        <div className="route-step">
          <Image src={busIcon} alt="バス" width={50} height={30} />
          <div className="route-step-content">
            <div className="route-step-time">八草駅 発 {fmt(route.shuttle_departure)}</div>
            <div className="route-step-detail">シャトルバスで出発</div>
          </div>
        </div>
        <div className="route-arrow" style={{ color: arrowColor }}>↓</div>
        <div className="route-step">
          <Image src={schoolIcon} alt="大学" width={50} height={30} />
          <div className="route-step-content">
            <div className="route-step-time">愛知工業大学 着 {fmt(route.shuttle_arrival)}</div>
            <div className="route-step-detail">到着</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="route-steps" style={{ color: stepsColor }}>
      <div className="route-step">
        <Image src={trainIcon} alt="電車" width={50} height={30} />
        <div className="route-step-content">
          <div className="route-step-time">{route.origin_name} 発 {fmt(route.linimo_departure)}</div>
          <div className="route-step-detail">{railName}で出発</div>
        </div>
      </div>
      <div className="route-arrow" style={{ color: arrowColor }}>↓</div>
      <div className="route-step">
        <Image src={busIcon} alt="バス" width={50} height={30} />
        <div className="route-step-content">
          <div className="route-step-time">八草駅 着 {fmt(route.linimo_arrival)}</div>
          <div className="route-step-detail">{railName}約{route.linimo_time}分</div>
        </div>
      </div>

      {shuttleOpts.length > 0 && (
        <>
          <div className="route-arrow" style={{ color: arrowColor }}>↓</div>
          <div className="route-step">
            <Image src={trainIcon} alt="時計" width={50} height={30} />
            <div className="route-step-content">
              <div className="route-step-time">乗り換え時間: {shuttleOpts[selectedShuttle]?.transfer_time ?? route.transfer_time}分</div>
              <div className="route-step-detail">シャトルバスへ乗り換え</div>
            </div>
          </div>

          <div className="route-arrow" style={{ color: arrowColor }}>↓</div>
          <div style={{ margin: "0.5rem 0" }}>
            <div className="segment-select-label" style={{ color: isDark ? "rgba(255,255,255,0.7)" : "#555" }}>
              シャトルバスを選択
            </div>
            <div className={`segment-container ${isDark ? "" : "light"}`}>
              {shuttleOpts.map((opt, i) => (
                <label key={i} className="segment-label" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="radio"
                    name={`shuttle_${route.linimo_departure}_${isDark}`}
                    checked={selectedShuttle === i}
                    onChange={() => onSelectShuttle(i)}
                    style={{ display: "none" }}
                  />
                  <div className={`segment-button ${selectedShuttle === i ? (isDark ? "selected-dark" : "selected-light") : ""}`}>
                    <div className={`segment-time ${!isDark ? (selectedShuttle === i ? "light-text" : "unselected") : ""}`}>
                      {fmt(opt.shuttle_departure)}
                    </div>
                    <div className={`segment-arrival ${!isDark ? (selectedShuttle === i ? "light-text" : "unselected") : ""}`}>
                      着{fmt(opt.shuttle_arrival)}
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div className="route-arrow" style={{ color: arrowColor }}>↓</div>
          <div className="route-step">
            <Image src={schoolIcon} alt="大学" width={50} height={30} />
            <div className="route-step-content">
              <div className="route-step-time">愛知工業大学 着 {effectiveShuttleArrival}</div>
              <div className="route-step-detail">到着</div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ============================================================
// 運行なし
// ============================================================

function NoServiceCard({ info, diaDescription }: { info: ServiceInfo; diaDescription: string }) {
  return (
    <div className="no-service-card">
      {info.is_before_service ? (
        <>
          <strong>⏰ 運行開始前</strong>
          <p>本日の運行はまだ開始していません。</p>
          {info.first && <p style={{ fontSize: "1.1em", marginTop: "8px" }}>初便: <strong>{info.first} 発</strong>（{info.direction_text}）</p>}
          {diaDescription && <p style={{ fontSize: "0.9em", marginTop: "8px", opacity: 0.9 }}>{diaDescription}</p>}
        </>
      ) : info.is_after_service ? (
        <>
          <strong>🌙 本日の運行は終了しました</strong>
          {info.last && <p>最終便: {info.last} 発（{info.direction_text}）</p>}
          {info.next_day_first && (
            <p style={{ marginTop: "12px", paddingTop: "12px", borderTop: "1px solid rgba(255,255,255,0.2)" }}>
              翌日始発: <strong>{info.next_day_first} 発</strong>（{info.direction_text}）
            </p>
          )}
          {diaDescription && <p style={{ fontSize: "0.9em", marginTop: "8px", opacity: 0.9 }}>{diaDescription}</p>}
        </>
      ) : (
        <>
          <strong>🚫 便が見つかりませんでした</strong>
          <p>現在、表示可能なルートがありません。運行時間をご確認ください。</p>
        </>
      )}
    </div>
  );
}
