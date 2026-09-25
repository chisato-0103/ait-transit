// トップページのシャトルバス時刻表区画用の整形。
// timetable.ts はリニモ・愛環の大きな JSON を読み込むため、ここからは import しない

export type ShuttleDiaType = "A" | "B" | "C";
export type ShuttleDirection = "to_university" | "to_yagusa";

export interface ShuttleRow {
  dia_type: string;
  direction: string;
  departure_time: string;
}

export interface HourRow {
  hour: number;
  minutes: string[];
}

const TIME_FORMAT = /^(\d{1,2}):(\d{2}):(\d{2})$/;

// "8:05:00" のようなゼロ埋めなしも受け付ける。
// 誤った時刻を黙って表示しないよう、形式・範囲が不正なら例外にしてビルドを止める
function parseHourMinute(time: string): { hour: number; minute: number } {
  const match = TIME_FORMAT.exec(time);
  if (!match) {
    throw new Error(`不正な時刻: ${time}`);
  }
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  const second = Number(match[3]);
  if (hour > 23 || minute > 59 || second > 59) {
    throw new Error(`不正な時刻: ${time}`);
  }
  return { hour, minute };
}

export function groupShuttleByHour(
  rows: ShuttleRow[],
  diaType: ShuttleDiaType,
  direction: ShuttleDirection
): HourRow[] {
  const times = rows
    .filter((r) => r.dia_type === diaType && r.direction === direction)
    .map((r) => parseHourMinute(r.departure_time))
    .sort((a, b) => a.hour * 60 + a.minute - (b.hour * 60 + b.minute));

  const result: HourRow[] = [];
  for (const t of times) {
    const minute = String(t.minute).padStart(2, "0");
    const last = result[result.length - 1];
    if (last && last.hour === t.hour) last.minutes.push(minute);
    else result.push({ hour: t.hour, minutes: [minute] });
  }
  return result;
}
