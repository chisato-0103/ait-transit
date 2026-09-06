// 臨時ダイヤ上書きの検証ロジックのテスト。実行: npm test
import assert from "node:assert";
import {
  validateDiaOverrides,
  sanitizeDiaOverrides,
  isValidDateStr,
  nowJstIso,
  getDiaOverrides,
  expireDiaOverridesCache,
  MAX_OVERRIDES,
  MAX_MEMO_LENGTH,
} from "../src/lib/diaOverrides";

let count = 0;
function test(name: string, fn: () => void) {
  fn();
  count++;
  console.log(`ok ${count} - ${name}`);
}

async function testAsync(name: string, fn: () => Promise<void>) {
  await fn();
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
test("保存時のupdated_atは入力値ではなくサーバー時刻になる", () => {
  const r = validateDiaOverrides([{ operation_date: "2026-09-06", dia_type: "B", updated_at: "1999-01-01T00:00:00+09:00" }]);
  assert.ok(r);
  assert.notEqual(r[0].updated_at, "1999-01-01T00:00:00+09:00");
  assert.match(r[0].updated_at, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\+09:00$/);
});
test("読み出しも日付昇順に整列し、上限を超えた分と長すぎるメモは丸める", () => {
  const r = sanitizeDiaOverrides([row("2026-09-08"), row("2026-09-06", "B", "あ".repeat(MAX_MEMO_LENGTH + 10))]);
  assert.deepEqual(r.map((o) => o.operation_date), ["2026-09-06", "2026-09-08"]);
  assert.equal(Array.from(r[0].memo ?? "").length, MAX_MEMO_LENGTH);
  const many = Array.from({ length: MAX_OVERRIDES + 5 }, (_, i) => row(`2027-01-01`.replace("01-01", `${String(Math.floor(i / 28) + 1).padStart(2, "0")}-${String((i % 28) + 1).padStart(2, "0")}`)));
  assert.equal(sanitizeDiaOverrides(many).length, MAX_OVERRIDES);
});
test("読み出しで配列以外は空配列になる", () => {
  assert.deepEqual(sanitizeDiaOverrides({ a: 1 }), []);
  assert.deepEqual(sanitizeDiaOverrides(null), []);
});

// ---- JST ----
test("nowJstIso はJSTのオフセット付きで返す", () => {
  assert.match(nowJstIso(), /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\+09:00$/);
});

// ---- 本番（GitHub取得）経路 ----
// process.env.VERCEL があるときだけGitHubを見る。fetchを差し替えて経路を確かめる
process.env.VERCEL = "1";
process.env.GITHUB_TOKEN = "dummy-token";
process.env.GITHUB_REPO = "owner/repo";

let fetchCalls = 0;
let lastIfNoneMatch: string | null = null;
type FetchResult = { kind: "ok"; body: unknown; etag: string } | { kind: "not_modified" } | { kind: "error" };
let nextResult: FetchResult = { kind: "error" };

globalThis.fetch = (async (_url: string, init?: RequestInit) => {
  fetchCalls++;
  lastIfNoneMatch = (init?.headers as Record<string, string> | undefined)?.["If-None-Match"] ?? null;
  if (nextResult.kind === "error") throw new Error("network down");
  if (nextResult.kind === "not_modified") return new Response(null, { status: 304 });
  const content = Buffer.from(JSON.stringify(nextResult.body), "utf-8").toString("base64");
  return new Response(JSON.stringify({ type: "file", content }), {
    status: 200,
    headers: { etag: nextResult.etag, "content-type": "application/json" },
  });
}) as typeof fetch;

const REMOTE = [{ operation_date: "2026-09-07", dia_type: "holiday", memo: "台風", updated_at: "2026-09-06T08:00:00+09:00" }];

async function runFetchTests() {
  await testAsync("キャッシュがない状態で取得に失敗したら同梱データにフォールバックする", async () => {
  nextResult = { kind: "error" };
  const r = await getDiaOverrides();
  assert.equal(r.source, "fallback");
  assert.deepEqual(r.overrides, []);
  assert.equal(r.fetched_at, null);
});

  await testAsync("GitHubから取得できたら上書きを返す", async () => {
  nextResult = { kind: "ok", body: REMOTE, etag: '"v1"' };
  const r = await getDiaOverrides();
  assert.equal(r.source, "github");
  assert.deepEqual(r.overrides.map((o) => o.operation_date), ["2026-09-07"]);
  assert.equal(r.overrides[0].dia_type, "holiday");
  assert.ok(r.fetched_at);
});

  await testAsync("TTL内は再取得しない", async () => {
  const before = fetchCalls;
  const r = await getDiaOverrides();
  assert.equal(fetchCalls, before);
  assert.equal(r.source, "github");
});

  await testAsync("取得に失敗しても直前に取れた上書きを捨てない", async () => {
  expireDiaOverridesCache();
  nextResult = { kind: "error" };
  const r = await getDiaOverrides();
  assert.equal(r.source, "stale");
  assert.equal(r.overrides[0].dia_type, "holiday");
});

  await testAsync("304ならETagを送って内容を維持し、通常状態に戻る", async () => {
  expireDiaOverridesCache();
  nextResult = { kind: "not_modified" };
  const r = await getDiaOverrides();
  assert.equal(lastIfNoneMatch, '"v1"');
  assert.equal(r.source, "github");
  assert.equal(r.overrides[0].dia_type, "holiday");
});

  await testAsync("GitHub上のデータが壊れていても正しい行だけ使う", async () => {
  expireDiaOverridesCache();
  nextResult = { kind: "ok", body: [{ operation_date: "2026-13-01", dia_type: "A" }, ...REMOTE], etag: '"v2"' };
  const r = await getDiaOverrides();
  assert.equal(r.source, "github");
  assert.deepEqual(r.overrides.map((o) => o.operation_date), ["2026-09-07"]);
});

}

runFetchTests().then(() => console.log(`\n${count}件すべて成功`));
