"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";

interface Station {
  station_code: string;
  station_name: string;
  line_type: string | null;
  order_index: number;
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
  linimo_options?: Array<{ linimo_departure: string; destination_arrival: string; transfer_time: number; total_time: number }>;
  shuttle_options?: Array<{ shuttle_departure: string; shuttle_arrival: string; transfer_time: number; total_time: number }>;
}

interface ApiResponse {
  success: boolean;
  data: {
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
  };
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

type RouteOption = "to_linimo" | "from_linimo" | "to_aichi_kanjo" | "from_aichi_kanjo";

interface Notice {
  id: number;
  date: string;
  title: string;
  body: string;
  type: "info" | "warning" | "alert";
  active: boolean;
}

export default function MainClient() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [currentTime, setCurrentTime] = useState("");
  const [stations, setStations] = useState<Station[]>([]);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [apiData, setApiData] = useState<ApiResponse["data"] | null>(null);
  const [loading, setLoading] = useState(true);
  const [routeOption, setRouteOptionState] = useState<RouteOption>("to_linimo");
  const [destination, setDestination] = useState("fujigaoka");
  const [origin, setOrigin] = useState("fujigaoka");

  // 現在時刻を更新
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

  // 駅一覧を取得
  useEffect(() => {
    fetch("/api/stations")
      .then((r) => r.json())
      .then((json) => setStations(json.data ?? []));
  }, []);

  // お知らせを取得
  useEffect(() => {
    fetch("/api/notices")
      .then((r) => r.json())
      .then((json) => setNotices(json.data ?? []));
  }, []);

  // URLパラメータから初期値を設定
  useEffect(() => {
    const dir = searchParams.get("direction");
    const lc = searchParams.get("line_code");
    const dst = searchParams.get("destination");
    const org = searchParams.get("origin");

    if (dir === "to_station" && lc === "linimo") setRouteOptionState("to_linimo");
    else if (dir === "to_university" && lc === "linimo") setRouteOptionState("from_linimo");
    else if (dir === "to_station" && lc === "aichi_kanjo") setRouteOptionState("to_aichi_kanjo");
    else if (dir === "to_university" && lc === "aichi_kanjo") setRouteOptionState("from_aichi_kanjo");

    if (dst) setDestination(dst);
    if (org) setOrigin(org);
  }, [searchParams]);

  const fetchRoutes = useCallback(async () => {
    setLoading(true);
    const direction = routeOption.startsWith("to_") && !routeOption.includes("aichi") ? "to_station" :
      routeOption === "to_aichi_kanjo" ? "to_station" : "to_university";
    const lineCode = routeOption.includes("aichi") ? "aichi_kanjo" : "linimo";
    const params = new URLSearchParams({ direction, line_code: lineCode });
    if (direction === "to_station") params.set("destination", destination);
    else params.set("origin", origin);

    const testDate = searchParams.get("test_date");
    const testTime = searchParams.get("test_time");
    if (testDate) params.set("test_date", testDate);
    if (testTime) params.set("test_time", testTime);

    try {
      const res = await fetch(`/api/next-connection?${params}`);
      const json: ApiResponse = await res.json();
      if (json.success) setApiData(json.data);
    } finally {
      setLoading(false);
    }
  }, [routeOption, destination, origin, searchParams]);

  // 30秒ごとに自動更新
  useEffect(() => {
    fetchRoutes();
    const id = setInterval(fetchRoutes, 30000);
    return () => clearInterval(id);
  }, [fetchRoutes]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchRoutes();
  };

  const linimoStations = stations.filter(
    (s) => s.line_type === "linimo" || s.station_code === "yakusa"
  );
  const aikanStations = stations.filter(
    (s) => s.line_type === "aichi_kanjo" || s.station_code === "yakusa"
  );
  const isToStation = routeOption === "to_linimo" || routeOption === "to_aichi_kanjo";
  const isLinimo = routeOption === "to_linimo" || routeOption === "from_linimo";
  const stationList = isLinimo ? linimoStations : aikanStations;

  return (
    <div className="app">
      <header className="header">
        <h1>愛工大交通情報システム</h1>
        <p>シャトルバス＆リニモ乗り継ぎ案内</p>
      </header>

      <div className="container">
        {/* 非公式警告 */}
        <div className="alert-banner">
          <strong>⚠️ 重要：本システムは非公式です</strong>
          <p>
            このシステムは愛知工業大学の学生による非公式サービスです。
            実際にご利用の際は必ず
            <a href="https://www.linimo.jp/" target="_blank" rel="noopener noreferrer">
              リニモ公式サイト
            </a>
            でご確認ください。
          </p>
        </div>

        {/* お知らせ */}
        {notices.length > 0 && (
          <section className="notices-section">
            <div className="section-header">📢 お知らせ</div>
            {notices.map((n) => (
              <div key={n.id} className={`notice-item notice-${n.type}`}>
                <div className="notice-meta">
                  <span className="notice-date">{n.date}</span>
                </div>
                <div className="notice-title">{n.title}</div>
                <div className="notice-body">{n.body}</div>
              </div>
            ))}
          </section>
        )}

        {/* 現在時刻 */}
        <div className="current-time-wrapper">
          <div className="current-time-label">⏰ 現在時刻</div>
          <div className="current-time">{currentTime || "読み込み中..."}</div>
        </div>

        {/* ルート検索 */}
        <section className="search-area">
          <div className="section-header">📍 ルート検索</div>
          <form className="search-form" onSubmit={handleSearch}>
            <div className="form-group">
              <label>路線と方向を選択</label>
              <div className="route-selection">
                {([
                  ["to_linimo", "🏫 大学 → 🚃 リニモ駅"],
                  ["from_linimo", "🚃 リニモ駅 → 🏫 大学"],
                  ["to_aichi_kanjo", "🏫 大学 → 🚆 愛知環状線駅"],
                  ["from_aichi_kanjo", "🚆 愛知環状線駅 → 🏫 大学"],
                ] as [RouteOption, string][]).map(([val, label]) => (
                  <label key={val} className="radio-option">
                    <input
                      type="radio"
                      name="route_option"
                      value={val}
                      checked={routeOption === val}
                      onChange={() => setRouteOptionState(val)}
                    />
                    <span>{label}</span>
                  </label>
                ))}
              </div>
            </div>

            {isToStation ? (
              <div className="form-group">
                <label htmlFor="destination">目的地を選択</label>
                <select
                  id="destination"
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                >
                  {stationList.map((s) => (
                    <option key={s.station_code} value={s.station_code}>
                      {s.station_name}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="form-group">
                <label htmlFor="origin">出発地を選択</label>
                <select
                  id="origin"
                  value={origin}
                  onChange={(e) => setOrigin(e.target.value)}
                >
                  {stationList.map((s) => (
                    <option key={s.station_code} value={s.station_code}>
                      {s.station_name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <button type="submit" className="btn btn-primary">
              検索
            </button>
          </form>
        </section>

        {/* 次の便 */}
        <div className="next-departure">
          {loading ? (
            <div style={{ textAlign: "center", padding: "2rem" }}>読み込み中...</div>
          ) : apiData ? (
            <RouteDisplay data={apiData} />
          ) : null}
        </div>
      </div>

      {/* ダイヤ情報フッター */}
      {apiData && (
        <div className="dia-info">
          <span>本日のダイヤ: {apiData.dia_description}</span>
          {apiData.day_description && <span> / {apiData.day_description}</span>}
        </div>
      )}
    </div>
  );
}

function RouteDisplay({ data }: { data: ApiResponse["data"] }) {
  if (data.routes.length === 0 && data.service_info) {
    return <ServiceInfoDisplay info={data.service_info} fromName={data.from_name} toName={data.to_name} />;
  }

  const [primary, ...others] = data.routes;

  return (
    <>
      {/* メイン便（大型表示） */}
      <div className="route-card route-card-primary">
        <div className="route-card-header">
          <span className="route-label">次の便</span>
          <span className="route-from-to">
            {data.from_name} → {data.to_name}
          </span>
        </div>
        <RouteDetails route={primary} isPrimary />
      </div>

      {/* その他の便 */}
      {others.length > 0 && (
        <section className="results">
          <h3 className="results-header">その他の便</h3>
          {others.map((route, i) => (
            <div key={i} className="route-card">
              <RouteDetails route={route} />
            </div>
          ))}
        </section>
      )}
    </>
  );
}

function RouteDetails({ route, isPrimary = false }: { route: RouteResult; isPrimary?: boolean }) {
  const waitMin = route.waiting_time;
  const totalMin = route.total_time;

  return (
    <div className={`route-details ${isPrimary ? "primary" : ""}`}>
      <div className="route-times">
        {/* シャトルバス */}
        {route.shuttle_departure && (
          <div className="route-step">
            <span className="step-icon">🚌</span>
            <div className="step-info">
              <div className="step-label">シャトルバス</div>
              <div className="step-time">
                {route.shuttle_departure}
                {route.shuttle_arrival && ` → ${route.shuttle_arrival}`}
              </div>
            </div>
          </div>
        )}

        {/* リニモ */}
        {route.linimo_departure && (
          <>
            <div className="route-connector">
              <span className="transfer-time">乗り換え {route.transfer_time}分</span>
            </div>
            <div className="route-step">
              <span className="step-icon">🚃</span>
              <div className="step-info">
                <div className="step-label">リニモ</div>
                <div className="step-time">
                  {route.linimo_departure}
                  {route.destination_arrival && ` → ${route.destination_arrival}`}
                </div>
                {route.destination_name && (
                  <div className="step-dest">→ {route.destination_name} 着</div>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      <div className="route-summary">
        <span className="waiting-badge">
          ⏱ あと {waitMin >= 0 ? `${waitMin}分` : "間もなく"}
        </span>
        <span className="total-badge">所要 {totalMin}分</span>
      </div>

      {/* リニモ選択肢 */}
      {route.linimo_options && route.linimo_options.length > 1 && (
        <details className="alt-options">
          <summary>他のリニモ便</summary>
          {route.linimo_options.slice(1).map((opt, i) => (
            <div key={i} className="alt-option">
              🚃 {opt.linimo_departure} 発 → {opt.destination_arrival} 着（乗り換え{opt.transfer_time}分）
            </div>
          ))}
        </details>
      )}

      {/* シャトル選択肢 */}
      {route.shuttle_options && route.shuttle_options.length > 1 && (
        <details className="alt-options">
          <summary>他のシャトル便</summary>
          {route.shuttle_options.slice(1).map((opt, i) => (
            <div key={i} className="alt-option">
              🚌 {opt.shuttle_departure} 発 → {opt.shuttle_arrival} 着（所要{opt.total_time}分）
            </div>
          ))}
        </details>
      )}
    </div>
  );
}

function ServiceInfoDisplay({ info, fromName, toName }: { info: ServiceInfo; fromName: string; toName: string }) {
  return (
    <div
      className="service-info-card"
      style={{ backgroundColor: info.bg_color, color: info.text_color }}
    >
      {info.is_after_service ? (
        <>
          <div className="service-icon">🌙</div>
          <div className="service-message">本日の運行は終了しました</div>
          {info.last && <div className="service-detail">最終便: {info.last}</div>}
          {info.next_day_first && (
            <div className="service-detail">
              明日の始発: {info.next_day_first}（{info.next_day_dia_description}）
            </div>
          )}
        </>
      ) : info.is_before_service ? (
        <>
          <div className="service-icon">🌅</div>
          <div className="service-message">本日の運行はまだ始まっていません</div>
          {info.first && <div className="service-detail">本日の始発: {info.first}</div>}
        </>
      ) : (
        <>
          <div className="service-icon">🚫</div>
          <div className="service-message">{fromName} → {toName} の便が見つかりませんでした</div>
        </>
      )}
    </div>
  );
}
