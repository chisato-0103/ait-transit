// 応援リンクの検証・期限判定のテスト。実行: npm test（npx tsx scripts/supportLink.test.ts）
import assert from "node:assert";
import {
  isValidSupportUrl,
  isValidExpiresAt,
  validateSupportLink,
  parseSupportLinkJson,
  isSupportLinkActive,
  getSupportLinkStatus,
  remainingDays,
  formatExpiresJst,
  toExpiresAt,
  toDatetimeLocal,
  MAX_SUPPORT_URL_LENGTH,
  NOTIFY_BEFORE_MS,
  SUPPORT_URL_PREFIX,
  type SupportLink,
} from "../src/lib/supportLink";

let count = 0;
function test(name: string, fn: () => void) {
  fn();
  count++;
  console.log(`ok ${count} - ${name}`);
}

const URL_OK = "https://qr.paypay.ne.jp/p2p01_CBebil50AeMBN19V";
const EXPIRES = "2026-09-28T19:57:00+09:00";
const EXPIRES_MS = Date.parse(EXPIRES);
const DAY = 24 * 60 * 60 * 1000;
const link: SupportLink = { url: URL_OK, expires_at: EXPIRES };

// ---- URL ----
test("PayPayの受け取りURLだけを受け付ける", () => {
  assert.equal(isValidSupportUrl(URL_OK), true);
  assert.equal(isValidSupportUrl("https://example.com/p2p01_abc"), false);
  assert.equal(isValidSupportUrl("javascript:alert(1)"), false);
  assert.equal(isValidSupportUrl("http://qr.paypay.ne.jp/p2p01_abc"), false);
  assert.equal(isValidSupportUrl("https://qr.paypay.ne.jp.evil.com/p2p01_abc"), false);
  assert.equal(isValidSupportUrl("https://qr.paypay.ne.jp/p2p01_abc?x=1"), false);
  assert.equal(isValidSupportUrl("https://qr.paypay.ne.jp/"), false);
  assert.equal(isValidSupportUrl(123), false);
});

test("URLの長さ上限", () => {
  const at = (n: number) => SUPPORT_URL_PREFIX + "a".repeat(n - SUPPORT_URL_PREFIX.length);
  assert.equal(isValidSupportUrl(at(MAX_SUPPORT_URL_LENGTH)), true);
  assert.equal(isValidSupportUrl(at(MAX_SUPPORT_URL_LENGTH + 1)), false);
});

// ---- 有効期限 ----
test("有効期限はJST固定の厳密な形式だけを受け付ける", () => {
  assert.equal(isValidExpiresAt(EXPIRES), true);
  assert.equal(isValidExpiresAt("2026-09-28T23:59:59+09:00"), true);
  assert.equal(isValidExpiresAt("2026-09-28T24:00:00+09:00"), false);
  assert.equal(isValidExpiresAt("2026-09-28T19:60:00+09:00"), false);
  assert.equal(isValidExpiresAt("2026-02-30T10:00:00+09:00"), false);
  assert.equal(isValidExpiresAt("2026-09-28T19:57:00"), false);
  assert.equal(isValidExpiresAt("2026-09-28T19:57:00Z"), false);
  assert.equal(isValidExpiresAt("2026-09-28T19:57:00+00:00"), false);
  assert.equal(isValidExpiresAt("2026-09-28 19:57:00+09:00"), false);
  assert.equal(isValidExpiresAt("2026-09-28T19:57+09:00"), false);
  assert.equal(isValidExpiresAt(null), false);
});

// ---- 保存時の検証 ----
test("正しい入力は url と expires_at だけを持つ新しいオブジェクトになる", () => {
  const r = validateSupportLink({ url: URL_OK, expires_at: EXPIRES, extra: "x" });
  assert.deepEqual(r, { url: URL_OK, expires_at: EXPIRES });
});

test("過去の日時も保存時の検証では受け付ける", () => {
  assert.ok(validateSupportLink({ url: URL_OK, expires_at: "2020-01-01T00:00:00+09:00" }));
});

test("不正な入力は null", () => {
  assert.equal(validateSupportLink(null), null);
  assert.equal(validateSupportLink([]), null);
  assert.equal(validateSupportLink("x"), null);
  assert.equal(validateSupportLink({ url: URL_OK }), null);
  assert.equal(validateSupportLink({ url: "https://example.com/a", expires_at: EXPIRES }), null);
});

// ---- 読み出し時のパース ----
test("JSON文字列から読み出す。壊れていれば null", () => {
  assert.deepEqual(parseSupportLinkJson(JSON.stringify({ ...link, extra: 1 })), link);
  assert.equal(parseSupportLinkJson("{ broken"), null);
  assert.equal(parseSupportLinkJson("null"), null);
  assert.equal(parseSupportLinkJson("[]"), null);
  assert.equal(parseSupportLinkJson(JSON.stringify({ url: "javascript:alert(1)", expires_at: EXPIRES })), null);
});

// ---- 期限判定 ----
test("期限の直前まで表示し、ちょうど以降は表示しない", () => {
  assert.equal(isSupportLinkActive(link, EXPIRES_MS - 1), true);
  assert.equal(isSupportLinkActive(link, EXPIRES_MS), false);
  assert.equal(isSupportLinkActive(link, EXPIRES_MS + 1), false);
  assert.equal(isSupportLinkActive(null, 0), false);
});

test("状態は残り3日以内で expiring、期限以降で expired", () => {
  assert.equal(getSupportLinkStatus(null, 0), "missing");
  assert.equal(getSupportLinkStatus(link, EXPIRES_MS - NOTIFY_BEFORE_MS - 1), "ok");
  assert.equal(getSupportLinkStatus(link, EXPIRES_MS - NOTIFY_BEFORE_MS), "expiring");
  assert.equal(getSupportLinkStatus(link, EXPIRES_MS - 1), "expiring");
  assert.equal(getSupportLinkStatus(link, EXPIRES_MS), "expired");
});

test("残り日数は切り捨て、期限を過ぎると負数", () => {
  assert.equal(remainingDays(link, EXPIRES_MS - 14 * DAY), 14);
  assert.equal(remainingDays(link, EXPIRES_MS - 2.5 * DAY), 2);
  assert.equal(remainingDays(link, EXPIRES_MS - 1), 0);
  assert.equal(remainingDays(link, EXPIRES_MS), 0);
  assert.equal(remainingDays(link, EXPIRES_MS + 1), -1);
});

// ---- 表示・入力の変換 ----
test("日時の表示と datetime-local との相互変換", () => {
  assert.equal(formatExpiresJst(EXPIRES), "2026-09-28 19:57");
  assert.equal(toExpiresAt("2026-09-28T19:57"), EXPIRES);
  assert.equal(toExpiresAt("2026-09-28T19:57:30"), "2026-09-28T19:57:30+09:00");
  assert.equal(toExpiresAt(""), "");
  assert.equal(toDatetimeLocal(EXPIRES), "2026-09-28T19:57");
});

console.log(`\n${count}件すべて成功`);
