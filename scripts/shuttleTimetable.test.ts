// シャトル時刻表区画の整形テスト。実行: npm test（npx tsx scripts/shuttleTimetable.test.ts）
import assert from "node:assert";
import timetable from "../src/data/shuttle_bus_timetable.json";
import { groupShuttleByHour, type ShuttleRow } from "../src/lib/shuttleTimetable";

let count = 0;
function test(name: string, fn: () => void) {
  fn();
  count++;
  console.log(`ok ${count} - ${name}`);
}

const rows: ShuttleRow[] = [
  { dia_type: "A", direction: "to_university", departure_time: "09:00:00" },
  { dia_type: "A", direction: "to_university", departure_time: "8:05:00" },
  { dia_type: "A", direction: "to_university", departure_time: "08:00:00" },
  { dia_type: "B", direction: "to_university", departure_time: "08:30:00" },
  { dia_type: "A", direction: "to_yagusa", departure_time: "08:20:00" },
];

test("時の昇順・分の昇順に並び、ゼロ埋めなしの時刻も同じ時にまとまる", () => {
  assert.deepStrictEqual(groupShuttleByHour(rows, "A", "to_university"), [
    { hour: 8, minutes: ["00", "05"] },
    { hour: 9, minutes: ["00"] },
  ]);
});

test("他のダイヤ・他の方向の便は含まれない", () => {
  assert.deepStrictEqual(groupShuttleByHour(rows, "B", "to_university"), [{ hour: 8, minutes: ["30"] }]);
  assert.deepStrictEqual(groupShuttleByHour(rows, "A", "to_yagusa"), [{ hour: 8, minutes: ["20"] }]);
  assert.deepStrictEqual(groupShuttleByHour(rows, "C", "to_university"), []);
});

test("数値にできない時刻は例外にする", () => {
  const bad: ShuttleRow[] = [{ dia_type: "A", direction: "to_university", departure_time: "xx:05:00" }];
  assert.throws(() => groupShuttleByHour(bad, "A", "to_university"), /不正な時刻/);
});

test("不正な形式・範囲外の時刻はすべて例外にする", () => {
  const invalidTimes = [
    ":05:00",
    "08::00",
    "08:60:00",
    "24:00:00",
    "08:05:60",
    "08:05",
    "08:05:00:00",
    "xx:05:00",
  ];
  for (const time of invalidTimes) {
    const bad: ShuttleRow[] = [{ dia_type: "A", direction: "to_university", departure_time: time }];
    assert.throws(
      () => groupShuttleByHour(bad, "A", "to_university"),
      /不正な時刻/,
      `${time} が例外にならなかった`
    );
  }
});

test("深夜0時台の時刻は有効として扱われる", () => {
  const midnight: ShuttleRow[] = [{ dia_type: "A", direction: "to_university", departure_time: "0:07:00" }];
  assert.deepStrictEqual(groupShuttleByHour(midnight, "A", "to_university"), [{ hour: 0, minutes: ["07"] }]);
});

test("実データ: A/B/C × 両方向の合計が JSON の全件（269）と一致する", () => {
  const all = timetable as ShuttleRow[];
  let total = 0;
  for (const dia of ["A", "B", "C"] as const) {
    for (const dir of ["to_university", "to_yagusa"] as const) {
      for (const h of groupShuttleByHour(all, dia, dir)) total += h.minutes.length;
    }
  }
  assert.strictEqual(all.length, 269);
  assert.strictEqual(total, 269);
});

console.log(`\n${count} tests passed`);
