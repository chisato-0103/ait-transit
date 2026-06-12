// timetable.ts の回帰テスト。実行: npm test（npx tsx scripts/timetable.test.ts）
import assert from "node:assert";
import {
  timeToMinutes,
  addMinutes,
  formatTime,
  getDiaType,
  getDayType,
  getNextLinimoTrains,
  getNextAichiKanjoTrains,
  getNextShuttleBuses,
  getLastShuttleBus,
  calculateUniversityToStation,
  calculateStationToUniversity,
  isExtraShuttleWindow,
} from "../src/lib/timetable";

let count = 0;
function test(name: string, fn: () => void) {
  fn();
  count++;
  console.log(`ok ${count} - ${name}`);
}

// ---- 時刻ユーティリティ ----
test("timeToMinutes はゼロ埋めなし表記を扱える", () => {
  assert.equal(timeToMinutes("5:31:00"), 331);
  assert.equal(timeToMinutes("0:07:00"), 7);
  assert.equal(timeToMinutes("23:45"), 1425);
});
test("addMinutes は日付またぎで24時間制に丸める", () => {
  assert.equal(addMinutes("23:50:00", 20), "00:10:00");
  assert.equal(addMinutes("00:10:00", -20), "23:50:00");
});
test("formatTime はゼロ埋めする", () => {
  assert.equal(formatTime("5:31:00"), "05:31");
});

// ---- ダイヤ判定（FY2026運行カレンダー） ----
test("運行カレンダー: 平日授業期間=A / 6月の土曜=休 / 8月平日=C", () => {
  assert.equal(getDiaType("2026-06-12"), "A");
  assert.equal(getDiaType("2026-06-13"), "holiday");
  assert.equal(getDiaType("2026-08-05"), "C");
});
test("dayType: A=weekday_green、それ以外=holiday_red", () => {
  assert.equal(getDayType("2026-06-12"), "weekday_green");
  assert.equal(getDayType("2026-08-05"), "holiday_red");
});

// ---- リニモ（公式照合済みの既知値） ----
test("八草発藤が丘方面の平日始発は5:30", () => {
  const t = getNextLinimoTrains("yakusa", "to_fujigaoka", "0:00:00", "weekday_green", 1);
  assert.equal(t[0].departure_time, "5:30:00");
});
test("八草発藤が丘方面の平日終発は23:45（以降は0件）", () => {
  assert.equal(getNextLinimoTrains("yakusa", "to_fujigaoka", "23:46:00", "weekday_green", 1).length, 0);
});
test("休日7時台は平日とダイヤが異なる", () => {
  const wk = getNextLinimoTrains("yakusa", "to_fujigaoka", "7:30:00", "weekday_green", 1)[0].departure_time;
  const hd = getNextLinimoTrains("yakusa", "to_fujigaoka", "7:30:00", "holiday_red", 1)[0].departure_time;
  assert.notEqual(wk, hd);
});

// ---- 愛環（曜日・行先到達判定） ----
test("高蔵寺発の土休日運休便（赤時刻）は休日に出ない", () => {
  const wk = getNextAichiKanjoTrains("kozoji", "to_okazaki", "6:00:00", "weekday_green", 5).map((t) => t.departure_time);
  const hd = getNextAichiKanjoTrains("kozoji", "to_okazaki", "6:00:00", "holiday_red", 5).map((t) => t.departure_time);
  assert.notDeepEqual(wk, hd);
});
test("八草23時台の岡崎方面は北野桝塚行きのみ → 岡崎には到達不可", () => {
  const all = getNextAichiKanjoTrains("yakusa", "to_okazaki", "23:00:00", "weekday_green", 5);
  assert.ok(all.length > 0 && all.every((t) => t.terminal === "北野桝塚"));
  const reachable = getNextAichiKanjoTrains("yakusa", "to_okazaki", "23:00:00", "weekday_green", 5, "okazaki");
  assert.equal(reachable.length, 0);
});
test("北野桝塚行きでも手前の駅（三河上郷）へは到達可", () => {
  const r = getNextAichiKanjoTrains("yakusa", "to_okazaki", "23:00:00", "weekday_green", 5, "mikawakamigo");
  assert.ok(r.length > 0);
});
test("駅コードの正規化（kita_okazaki → kitaokazaki）", () => {
  const r = getNextAichiKanjoTrains("kita_okazaki", "to_kozoji", "12:00:00", "weekday_green", 1);
  assert.ok(r.length > 0);
});

// ---- シャトルバス ----
test("Aダイヤの始発8:00・八草行き終バス21:45（公式PDF照合済み）", () => {
  assert.equal(getNextShuttleBuses("to_university", "0:00:00", "A", 1)[0].departure_time, "08:00:00");
  assert.equal(getLastShuttleBus("to_yagusa", "A")?.departure_time, "21:45:00");
});
test("臨時バス案内はA/Bダイヤの7:55〜10:45のみ", () => {
  assert.equal(isExtraShuttleWindow("A", "7:55:00"), true);
  assert.equal(isExtraShuttleWindow("A", "7:54:00"), false);
  assert.equal(isExtraShuttleWindow("A", "10:46:00"), false);
  assert.equal(isExtraShuttleWindow("C", "9:00:00"), false);
});

// ---- 乗継計算 ----
test("大学→藤が丘: バス到着+乗換5分以降のリニモに乗る", () => {
  const r = calculateUniversityToStation("fujigaoka", "12:00:00", "A", "weekday_green", 1)[0];
  assert.equal(r.shuttle_departure, "12:00");
  assert.equal(r.shuttle_arrival, "12:05");
  const linimoDep = timeToMinutes(r.linimo_departure!);
  assert.ok(linimoDep >= timeToMinutes(r.shuttle_arrival!) + 5);
});
test("瀬戸市→大学: 電車→八草→バスの順で時刻が進む", () => {
  const r = calculateStationToUniversity("setoshi", "7:00:00", "A", "weekday_green", 1)[0];
  assert.ok(timeToMinutes(r.linimo_arrival!) > timeToMinutes(r.linimo_departure!));
  assert.ok(timeToMinutes(r.shuttle_departure!) >= timeToMinutes(r.linimo_arrival!) + 5);
});

console.log(`\n${count}件すべて成功`);
