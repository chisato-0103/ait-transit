// 臨時ダイヤ上書きの検証ロジックのテスト。実行: npm test
import assert from "node:assert";
import {
  validateDiaOverrides,
  sanitizeDiaOverrides,
  isValidDateStr,
  nowJstIso,
  MAX_OVERRIDES,
  MAX_MEMO_LENGTH,
} from "../src/lib/diaOverrides";

let count = 0;
function test(name: string, fn: () => void) {
  fn();
  count++;
  console.log(`ok ${count} - ${name}`);
}

const row = (date: string, dia = "B", memo?: string) => ({ operation_date: date, dia_type: dia, memo });

// ---- 日付検証 ----
test("実在しない日付を拒否する", () => {
  assert.equal(isValidDateStr("2026-09-06"), true);
  assert.equal(isValidDateStr("2026-02-30"), false);
  assert.equal(isValidDateStr("2026-13-01"), false);
  assert.equal(isValidDateStr("2026-00-10"), false);
  assert.equal(isValidDateStr("0000-01-01"), false);
  assert.equal(isValidDateStr("2026-9-6"), false);
  assert.equal(isValidDateStr("2026-09-06T00:00:00"), false);
  assert.equal(isValidDateStr(20260906), false);
});

// ---- 保存時の検証 ----
test("正しい入力は通り、updated_atが付与される", () => {
  const r = validateDiaOverrides([row("2026-09-06", "holiday", "臨時運休")]);
  assert.ok(r);
  assert.equal(r[0].dia_type, "holiday");
  assert.equal(r[0].memo, "臨時運休");
  assert.match(r[0].updated_at, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\+09:00$/);
});
test("日付昇順に並べ替えて保存する", () => {
  const r = validateDiaOverrides([row("2026-09-08"), row("2026-09-06"), row("2026-09-07")]);
  assert.deepEqual(r?.map((o) => o.operation_date), ["2026-09-06", "2026-09-07", "2026-09-08"]);
});
test("存在しない日付を含むと全体を拒否する", () => {
  assert.equal(validateDiaOverrides([row("2026-09-06"), row("2026-02-30")]), null);
});
test("不正なダイヤ種別を拒否する", () => {
  assert.equal(validateDiaOverrides([row("2026-09-06", "X")]), null);
  assert.equal(validateDiaOverrides([row("2026-09-06", "a")]), null);
});
test("同じ日付の重複を拒否する", () => {
  assert.equal(validateDiaOverrides([row("2026-09-06", "B"), row("2026-09-06", "C")]), null);
});
test("件数の上限は100件", () => {
  const make = (n: number) =>
    Array.from({ length: n }, (_, i) => row(`2026-${String(Math.floor(i / 28) + 1).padStart(2, "0")}-${String((i % 28) + 1).padStart(2, "0")}`));
  assert.equal(validateDiaOverrides(make(MAX_OVERRIDES))?.length, MAX_OVERRIDES);
  assert.equal(validateDiaOverrides(make(MAX_OVERRIDES + 1)), null);
});
test("memoは100字まで（サロゲートペアは1字として数える）", () => {
  assert.ok(validateDiaOverrides([row("2026-09-06", "B", "あ".repeat(MAX_MEMO_LENGTH))]));
  assert.equal(validateDiaOverrides([row("2026-09-06", "B", "あ".repeat(MAX_MEMO_LENGTH + 1))]), null);
  assert.ok(validateDiaOverrides([row("2026-09-06", "B", "🚌".repeat(MAX_MEMO_LENGTH))]));
});
test("memoは省略可能で、空文字は保存しない", () => {
  const r = validateDiaOverrides([{ operation_date: "2026-09-06", dia_type: "B" }]);
  assert.ok(r && !("memo" in r[0]));
  const empty = validateDiaOverrides([row("2026-09-06", "B", "")]);
  assert.ok(empty && !("memo" in empty[0]));
});
test("配列でない入力を拒否する", () => {
  assert.equal(validateDiaOverrides({ operation_date: "2026-09-06", dia_type: "B" }), null);
  assert.equal(validateDiaOverrides(null), null);
  assert.equal(validateDiaOverrides("[]"), null);
  assert.equal(validateDiaOverrides([null]), null);
});
test("空配列は有効（上書きなしの状態）", () => {
  assert.deepEqual(validateDiaOverrides([]), []);
});

// ---- 読み出し時の検証 ----
test("読み出しは壊れた行だけを捨てて残りを使う", () => {
  const r = sanitizeDiaOverrides([row("2026-02-30"), row("2026-09-06", "B"), row("2026-09-07", "X"), null]);
  assert.deepEqual(r.map((o) => o.operation_date), ["2026-09-06"]);
});
test("読み出しで日付が重複したら先頭を採用する", () => {
  const r = sanitizeDiaOverrides([row("2026-09-06", "C"), row("2026-09-06", "B")]);
  assert.equal(r.length, 1);
  assert.equal(r[0].dia_type, "C");
});
test("読み出しはupdated_atの欠落を許容する", () => {
  const r = sanitizeDiaOverrides([{ operation_date: "2026-09-06", dia_type: "B" }]);
  assert.equal(r.length, 1);
  assert.equal(r[0].updated_at, "");
});
test("読み出しで配列以外は空配列になる", () => {
  assert.deepEqual(sanitizeDiaOverrides({ a: 1 }), []);
  assert.deepEqual(sanitizeDiaOverrides(null), []);
});

// ---- JST ----
test("nowJstIso はJSTのオフセット付きで返す", () => {
  assert.match(nowJstIso(), /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\+09:00$/);
});

console.log(`\n${count}件すべて成功`);
