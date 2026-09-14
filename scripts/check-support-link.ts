// 応援リンク（PayPay受け取りリンク）の期限チェック。
// 期限3日前・期限切れ・未設定を検知し、GitHub Actions 用に status と Issue 本文を出力する。
// 使い方: npx tsx scripts/check-support-link.ts
import { randomUUID } from "crypto";
import { appendFileSync, readFileSync } from "fs";
import {
  SUPPORT_LINK_REL_PATH,
  formatExpiresJst,
  getSupportLinkStatus,
  parseSupportLinkJson,
  remainingDays,
} from "../src/lib/supportLink";

let raw: string | null = null;
try {
  raw = readFileSync(SUPPORT_LINK_REL_PATH, "utf-8");
} catch (e) {
  console.error(`${SUPPORT_LINK_REL_PATH} を読めません: ${e instanceof Error ? e.message : String(e)}`);
}

const link = raw === null ? null : parseSupportLinkJson(raw);
const nowMs = Date.now();
const status = getSupportLinkStatus(link, nowMs);

const summary = !link
  ? `応援リンクが未設定、または ${SUPPORT_LINK_REL_PATH} を読み取れません。トップページには表示されていません。`
  : status === "expired"
    ? `応援リンクの期限が切れています（${formatExpiresJst(link.expires_at)} まで）。トップページには表示されていません。`
    : `応援リンクの期限が近づいています（${formatExpiresJst(link.expires_at)} まで、あと${remainingDays(link, nowMs)}日）。`;

const body = [
  summary,
  "",
  "対応手順:",
  "1. PayPayアプリで受け取りリンクを作り直す",
  "2. 管理画面（/admin）の「💰 応援リンク」欄で URL と有効期限（日本時間）を更新して保存する",
  "3. このIssueを閉じる",
  "",
  "（このIssueは check-support-link ワークフローが自動作成しました）",
].join("\n");

console.log(`status=${status}`);
console.log(status === "ok" ? `期限 ${link ? formatExpiresJst(link.expires_at) : "-"}（通知不要）` : summary);

if (process.env.GITHUB_OUTPUT) {
  // 本文に区切り文字が混ざっても出力が壊れないよう、区切りは毎回ランダムにする
  const delimiter = `EOF_${randomUUID()}`;
  appendFileSync(process.env.GITHUB_OUTPUT, `status=${status}\n`);
  appendFileSync(process.env.GITHUB_OUTPUT, `body<<${delimiter}\n${body}\n${delimiter}\n`);
}
