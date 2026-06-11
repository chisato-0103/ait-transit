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

  if (direction === "to_station") {
    fromName = "愛知工業大学";
    if (lineCode === "linimo" || lineCode === "aichi_kanjo") {
      routes = calculateUniversityToStation(destination, currentTime, diaType, dayType, limit);
    }
    // toName from routes or station lookup
    toName = routes[0]?.destination_name ?? destination;
  } else {
    toName = "愛知工業大学";
    if (origin === "yakusa") {
      routes = calculateYagusaToUniversity(currentTime, diaType, limit);
      fromName = "八草駅";
    } else {
      routes = calculateStationToUniversity(origin, currentTime, diaType, dayType, limit);
      fromName = routes[0]?.origin_name ?? origin;
    }
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
    },
  });
}
