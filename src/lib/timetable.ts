/**
 * 時刻表ロジック（PHPのdb_functions.phpをTypeScriptに移植）
 */

import shuttleBusTimetableRaw from "@/data/shuttle_bus_timetable.json";
import linimoTimetableRaw from "@/data/linimo_timetable.json";
import stationsRaw from "@/data/stations.json";
import shuttleScheduleRaw from "@/data/shuttle_schedule.json";

// ============================================================
// 型定義
// ============================================================

export type DiaType = "A" | "B" | "C" | "holiday";
export type DayType = "weekday_green" | "holiday_red";
export type Direction = "to_station" | "to_university";
export type ShuttleDirection = "to_university" | "to_yagusa";
export type LinimoDirection = "to_fujigaoka" | "to_yagusa";

export interface Station {
  station_code: string;
  station_name: string;
  station_name_en: string;
  order_index: number;
  travel_time_from_yakusa: number;
  line_type: string | null;
}

export interface ShuttleBusEntry {
  dia_type: string;
  direction: string;
  departure_time: string;
  arrival_time: string;
}

export interface LinimoEntry {
  station_code: string;
  station_name: string;
  direction: string;
  departure_time: string;
  day_type: string;
}

export interface LinimoOption {
  linimo_departure: string;
  destination_arrival: string;
  transfer_time: number;
  total_time: number;
  linimo_time: number;
}

export interface ShuttleOption {
  shuttle_departure: string;
  shuttle_arrival: string;
  transfer_time: number;
  total_time: number;
}

export interface RouteResult {
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

export interface ServiceInfo {
  type: string;
  direction_text: string;
  last: string | null;
  first: string | null;
  next_day_first: string | null;
  next_day_dia_type: DiaType;
  next_day_dia_description: string;
  is_before_service: boolean;
  is_after_service: boolean;
  bg_color: string;
  text_color: string;
}

// ============================================================
// 定数
// ============================================================

export const TRANSFER_TIME_MINUTES = 10;
export const RESULT_LIMIT = 3;
export const DEFAULT_DESTINATION = "fujigaoka";

export const DIA_TYPE_DESCRIPTIONS: Record<string, string> = {
  A: "授業期間平日（4月〜7月、10月〜1月）",
  B: "土曜日",
  C: "学校休業期間（8月、9月、2月、3月の平日）",
  holiday: "運休日",
};

export const DAY_TYPE_DESCRIPTIONS: Record<string, string> = {
  weekday_green: "平日（4月〜7月、10月〜1月）",
  holiday_red: "土休日・学校休業期間（8月、9月、2月、3月）",
};

// ============================================================
// 時刻ユーティリティ
// ============================================================

export function timeToMinutes(time: string): number {
  const parts = time.split(":").map(Number);
  return parts[0] * 60 + parts[1];
}

export function formatTime(time: string): string {
  if (!time) return "";
  const [h, m] = time.split(":");
  return `${String(Number(h)).padStart(2, "0")}:${m}`;
}

export function calculateDuration(start: string, end: string): number {
  return timeToMinutes(end) - timeToMinutes(start);
}

export function addMinutes(time: string, minutes: number): string {
  const total = timeToMinutes(time) + minutes;
  const h = Math.floor(total / 60) % 24;
  const m = ((total % 60) + 60) % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00`;
}

export function timeGte(a: string, b: string): boolean {
  return timeToMinutes(a) >= timeToMinutes(b);
}

// ============================================================
// ダイヤ判定
// ============================================================

export function getDiaType(dateStr: string): DiaType {
  const schedule = (shuttleScheduleRaw as Array<{ operation_date: string; dia_type: string }>).find(
    (s) => s.operation_date === dateStr
  );
  if (schedule) return schedule.dia_type as DiaType;

  const date = new Date(dateStr + "T00:00:00+09:00");
  const dow = date.getDay();
  const month = date.getMonth() + 1;
  if (dow === 0) return "holiday";
  if (dow === 6) return "B";
  if ([8, 9, 2, 3].includes(month)) return "C";
  return "A";
}

export function getDayType(dateStr: string): DayType {
  const diaType = getDiaType(dateStr);
  return diaType === "A" ? "weekday_green" : "holiday_red";
}

export function getTodayStr(): string {
  const now = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Tokyo" })
  );
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

export function getTomorrowStr(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00+09:00");
  d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// ============================================================
// データアクセス
// ============================================================

export function getAllStations(): Station[] {
  return (stationsRaw as Station[]).sort((a, b) => a.order_index - b.order_index);
}

const CODE_MAP: Record<string, string> = {
  aikan_umetsubo: "aikanumetubo",
  aikanumetsubo: "aikanumetubo",
  kita_okazaki: "kitaokazaki",
  kitano_masuzuka: "kitanomasuduka",
  kitanomasuzuka: "kitanomasuduka",
  mikawa_kamigo: "mikawakamigo",
  mikawa_toyota: "mikawatoyota",
  shin_uwagoromo: "shinuwagoromo",
  shin_toyota: "shintoyota",
  naka_okazaki: "nakaokazaki",
};

export function getStationByCode(code: string): Station | undefined {
  const normalized = CODE_MAP[code] ?? code;
  return (stationsRaw as Station[]).find((s) => s.station_code === normalized);
}

export function getNextShuttleBuses(
  direction: ShuttleDirection,
  currentTime: string,
  diaType: DiaType,
  limit = 5
): ShuttleBusEntry[] {
  return (shuttleBusTimetableRaw as ShuttleBusEntry[])
    .filter((r) => r.direction === direction && r.dia_type === diaType && timeGte(r.departure_time, currentTime))
    .sort((a, b) => timeToMinutes(a.departure_time) - timeToMinutes(b.departure_time))
    .slice(0, limit);
}

export function getNextLinimoTrains(
  stationCode: string,
  direction: LinimoDirection,
  currentTime: string,
  dayType: DayType,
  limit = 5
): LinimoEntry[] {
  const searchTime = currentTime.length === 5 ? currentTime + ":00" : currentTime;
  return (linimoTimetableRaw as LinimoEntry[])
    .filter((r) => r.station_code === stationCode && r.direction === direction && r.day_type === dayType && timeGte(r.departure_time, searchTime))
    .sort((a, b) => timeToMinutes(a.departure_time) - timeToMinutes(b.departure_time))
    .slice(0, limit);
}

export function getLastShuttleBus(direction: ShuttleDirection, diaType: DiaType): ShuttleBusEntry | undefined {
  return (shuttleBusTimetableRaw as ShuttleBusEntry[])
    .filter((r) => r.direction === direction && r.dia_type === diaType)
    .sort((a, b) => timeToMinutes(b.departure_time) - timeToMinutes(a.departure_time))[0];
}

export function getFirstShuttleBus(direction: ShuttleDirection, diaType: DiaType): ShuttleBusEntry | undefined {
  return (shuttleBusTimetableRaw as ShuttleBusEntry[])
    .filter((r) => r.direction === direction && r.dia_type === diaType)
    .sort((a, b) => timeToMinutes(a.departure_time) - timeToMinutes(b.departure_time))[0];
}

// ============================================================
// ルート計算
// ============================================================

export function calculateUniversityToStation(
  destinationCode: string,
  currentTime: string,
  diaType: DiaType,
  dayType: DayType,
  limit = RESULT_LIMIT
): RouteResult[] {
  const dest = getStationByCode(destinationCode);
  if (!dest) return [];

  if (destinationCode === "yakusa") {
    const shuttles = getNextShuttleBuses("to_yagusa", currentTime, diaType, limit);
    return shuttles.map((s) => ({
      shuttle_departure: formatTime(s.departure_time),
      shuttle_arrival: formatTime(s.arrival_time),
      linimo_departure: null,
      destination_arrival: formatTime(s.arrival_time),
      transfer_time: 0,
      total_time: calculateDuration(s.departure_time, s.arrival_time),
      waiting_time: calculateDuration(currentTime, s.departure_time),
      destination_name: dest.station_name,
    }));
  }

  const linimoTravelTime = dest.travel_time_from_yakusa;
  const shuttles = getNextShuttleBuses("to_yagusa", currentTime, diaType, 10);
  const routes: RouteResult[] = [];

  for (const shuttle of shuttles) {
    const yagusaArrival = shuttle.arrival_time;
    const minLinimoTime = addMinutes(yagusaArrival, TRANSFER_TIME_MINUTES);
    // 八草駅のデータは折り返し到着時刻として to_yagusa で記録されている
    const linimoOpts3 = getNextLinimoTrains("yakusa", "to_yagusa", minLinimoTime, dayType, 3);
    if (!linimoOpts3.length) continue;

    const linimo = linimoOpts3[0];
    const destArrival = addMinutes(linimo.departure_time, linimoTravelTime);

    routes.push({
      shuttle_departure: formatTime(shuttle.departure_time),
      shuttle_arrival: formatTime(yagusaArrival),
      linimo_departure: formatTime(linimo.departure_time),
      destination_arrival: formatTime(destArrival),
      transfer_time: calculateDuration(yagusaArrival, linimo.departure_time),
      total_time: calculateDuration(currentTime, destArrival),
      waiting_time: calculateDuration(currentTime, shuttle.departure_time),
      destination_name: dest.station_name,
      linimo_options: linimoOpts3.map((opt) => {
        const optDest = addMinutes(opt.departure_time, linimoTravelTime);
        return {
          linimo_departure: formatTime(opt.departure_time),
          destination_arrival: formatTime(optDest),
          transfer_time: calculateDuration(yagusaArrival, opt.departure_time),
          total_time: calculateDuration(currentTime, optDest),
          linimo_time: linimoTravelTime,
        };
      }),
    });
    if (routes.length >= limit) break;
  }
  return routes;
}

export function calculateStationToUniversity(
  originCode: string,
  currentTime: string,
  diaType: DiaType,
  dayType: DayType,
  limit = RESULT_LIMIT
): RouteResult[] {
  const originInfo = getStationByCode(originCode);
  if (!originInfo) return [];

  const linimoTravelTime = originInfo.travel_time_from_yakusa;
  let linimoTrains = getNextLinimoTrains(originCode, "to_yagusa", currentTime, dayType, 30);
  const useReverse = linimoTrains.length === 0;
  if (useReverse) {
    // 藤が丘などの終端駅は to_yagusa データなし → 八草の到着時刻 (to_yagusa) から逆算
    linimoTrains = getNextLinimoTrains("yakusa", "to_yagusa", currentTime, dayType, 30);
  }

  const routes: RouteResult[] = [];
  for (const linimo of linimoTrains) {
    let originDeparture: string;
    let yagusaArrival: string;

    if (useReverse) {
      originDeparture = addMinutes(linimo.departure_time, -linimoTravelTime);
      if (timeToMinutes(originDeparture) < timeToMinutes(currentTime)) continue;
      yagusaArrival = addMinutes(linimo.departure_time, 2);
    } else {
      originDeparture = linimo.departure_time;
      yagusaArrival = addMinutes(originDeparture, linimoTravelTime);
    }

    const minShuttleTime = addMinutes(yagusaArrival, TRANSFER_TIME_MINUTES);
    const shuttles = getNextShuttleBuses("to_university", minShuttleTime, diaType, 3);
    if (!shuttles.length) continue;

    const shuttle = shuttles[0];
    routes.push({
      linimo_departure: formatTime(originDeparture),
      linimo_arrival: formatTime(yagusaArrival),
      shuttle_departure: formatTime(shuttle.departure_time),
      shuttle_arrival: formatTime(shuttle.arrival_time),
      transfer_time: calculateDuration(yagusaArrival, shuttle.departure_time),
      total_time: calculateDuration(originDeparture, shuttle.arrival_time),
      waiting_time: calculateDuration(currentTime, originDeparture),
      linimo_time: linimoTravelTime,
      origin_name: originInfo.station_name,
      shuttle_options: shuttles.map((opt) => ({
        shuttle_departure: formatTime(opt.departure_time),
        shuttle_arrival: formatTime(opt.arrival_time),
        transfer_time: calculateDuration(yagusaArrival, opt.departure_time),
        total_time: calculateDuration(currentTime, opt.arrival_time),
      })),
    });
    if (routes.length >= limit) break;
  }
  return routes;
}

export function calculateYagusaToUniversity(
  currentTime: string,
  diaType: DiaType,
  limit = RESULT_LIMIT
): RouteResult[] {
  const shuttles = getNextShuttleBuses("to_university", currentTime, diaType, 3);
  return shuttles.slice(0, limit).map((shuttle, idx) => ({
    origin_name: "八草駅",
    destination_name: "愛知工業大学",
    shuttle_departure: formatTime(shuttle.departure_time),
    shuttle_arrival: formatTime(shuttle.arrival_time),
    linimo_departure: null,
    linimo_arrival: null,
    linimo_time: 0,
    transfer_time: 0,
    waiting_time: calculateDuration(currentTime, shuttle.departure_time),
    total_time: calculateDuration(shuttle.departure_time, shuttle.arrival_time),
    shuttle_options: shuttles.slice(idx).map((opt) => ({
      shuttle_departure: formatTime(opt.departure_time),
      shuttle_arrival: formatTime(opt.arrival_time),
      transfer_time: 0,
      total_time: calculateDuration(opt.departure_time, opt.arrival_time),
    })),
  }));
}

export function buildServiceInfo(
  direction: Direction,
  diaType: DiaType,
  nextDayDiaType: DiaType,
  currentTime: string
): ServiceInfo {
  const shuttleDir: ShuttleDirection = direction === "to_station" ? "to_yagusa" : "to_university";
  const dirText = direction === "to_station" ? "八草駅行き" : "大学行き";
  const last = getLastShuttleBus(shuttleDir, diaType);
  const first = getFirstShuttleBus(shuttleDir, diaType);
  const nextFirst = getFirstShuttleBus(shuttleDir, nextDayDiaType);
  const currentHour = parseInt(currentTime.split(":")[0], 10);
  const isAfterService = last
    ? timeToMinutes(currentTime) > timeToMinutes(last.departure_time)
    : currentHour >= 22;

  return {
    type: "shuttle",
    direction_text: dirText,
    last: last ? formatTime(last.departure_time) : null,
    first: first ? formatTime(first.departure_time) : null,
    next_day_first: nextFirst ? formatTime(nextFirst.departure_time) : null,
    next_day_dia_type: nextDayDiaType,
    next_day_dia_description: DIA_TYPE_DESCRIPTIONS[nextDayDiaType] ?? `ダイヤ${nextDayDiaType}`,
    is_before_service: currentHour < 8,
    is_after_service: isAfterService,
    bg_color: isAfterService ? "#1e3a5f" : "#0052a3",
    text_color: "#ffffff",
  };
}
