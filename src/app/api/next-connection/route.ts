import { NextRequest, NextResponse } from "next/server";
import {
  getDiaType,
  getDayType,
  getTodayStr,
  getTomorrowStr,
  calculateUniversityToStation,
  calculateStationToUniversity,
  calculateYagusaToUniversity,
  buildServiceInfo,
  getLastShuttleBus,
  formatTime,
  addMinutes,
  timeToMinutes,
  isExtraShuttleWindow,
  DIA_TYPE_DESCRIPTIONS,
  DAY_TYPE_DESCRIPTIONS,
  RESULT_LIMIT,
  DEFAULT_DESTINATION,
  type DiaType,
} from "@/lib/timetable";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const direction = (searchParams.get("direction") ?? "to_station") as "to_station" | "to_university";
  const lineCode = searchParams.get("line_code") ?? "linimo";
  const limit = parseInt(searchParams.get("limit") ?? String(RESULT_LIMIT), 10);
  const testDate = searchParams.get("test_date");
  const testTime = searchParams.get("test_time");
  // arrival: test_time を「この時刻までに到着」の期限として逆算検索する
  const searchMode = searchParams.get("search_mode") === "arrival" ? "arrival" : "departure";
  // 到着基準のとき、何分前まで遡って候補を探すか
  const ARRIVAL_WINDOW_MINUTES = 180;

  // 現在時刻（JST = UTC+9）
  const nowJST = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const currentTime =
    testTime ??
    `${String(nowJST.getUTCHours()).padStart(2, "0")}:${String(nowJST.getUTCMinutes()).padStart(2, "0")}:${String(nowJST.getUTCSeconds()).padStart(2, "0")}`;
  const dateStr = testDate ?? getTodayStr();

  const diaType = getDiaType(dateStr);
  const dayType = getDayType(dateStr);
  const tomorrowDiaType = getDiaType(getTomorrowStr(dateStr));

  let destination = searchParams.get("destination") ?? DEFAULT_DESTINATION;
  let origin = searchParams.get("origin") ?? DEFAULT_DESTINATION;
  let fromName = "";
  let toName = "";
  let routes: ReturnType<typeof calculateUniversityToStation> = [];

  // 到着基準: 期限の3時間前を起点に順方向計算し、期限までに着く便を抽出
  const searchBase = searchMode === "arrival" ? addMinutes(currentTime, -ARRIVAL_WINDOW_MINUTES) : currentTime;
  const searchLimit = searchMode === "arrival" ? 40 : limit;

  if (direction === "to_station") {
    fromName = "愛知工業大学";
    if (lineCode === "linimo" || lineCode === "aichi_kanjo") {
      routes = calculateUniversityToStation(destination, searchBase, diaType, dayType, searchLimit);
    }
    // toName from routes or station lookup
    toName = routes[0]?.destination_name ?? destination;
  } else {
    toName = "愛知工業大学";
    if (origin === "yakusa") {
      routes = calculateYagusaToUniversity(searchBase, diaType, searchLimit);
      fromName = "八草駅";
    } else {
      routes = calculateStationToUniversity(origin, searchBase, diaType, dayType, searchLimit);
      fromName = routes[0]?.origin_name ?? origin;
    }
  }

  if (searchMode === "arrival") {
    // 目的地到着時刻が期限以内の便だけ残し、出発が遅い順（=期限ギリギリの最終から）に並べる
    const deadline = timeToMinutes(currentTime);
    const windowStart = timeToMinutes(searchBase);
    routes = routes
      .filter((r) => {
        const arr = direction === "to_station" ? r.destination_arrival : r.shuttle_arrival;
        if (!arr) return false;
        const a = timeToMinutes(arr);
        return a <= deadline && a >= windowStart;
      })
      .slice(-limit)
      .reverse();
  }

  let serviceInfo = null;
  if (routes.length === 0) {
    serviceInfo = buildServiceInfo(direction, diaType, tomorrowDiaType as DiaType, currentTime);
  }

  return NextResponse.json({
    success: true,
    data: {
      current_time: currentTime,
      dia_type: diaType,
      dia_description: DIA_TYPE_DESCRIPTIONS[diaType] ?? `ダイヤ${diaType}`,
      day_type: dayType,
      day_description: DAY_TYPE_DESCRIPTIONS[dayType] ?? "",
      direction,
      line_code: lineCode,
      from_name: fromName,
      to_name: toName,
      routes,
      service_info: serviceInfo,
      extra_shuttle_notice: isExtraShuttleWindow(diaType, currentTime),
      last_shuttle: (() => {
        const last = getLastShuttleBus(direction === "to_station" ? "to_yagusa" : "to_university", diaType);
        return last ? formatTime(last.departure_time) : null;
      })(),
      last_shuttle_label: direction === "to_station" ? "八草駅行き" : "大学行き",
    },
  });
}
