/**
 * 開発者への応援リンク（PayPay受け取りリンク）の検証と期限判定。
 * PayPayのリンクは期限切れでもWeb上は区別できないため、発行時に表示される有効期限を記録して日付で管理する。
 * MainClient（クライアント）からも読み込むので、fs などサーバー専用モジュールに依存しないこと。
 */

export const SUPPORT_LINK_REL_PATH = "src/data/support_link.json";
export const SUPPORT_URL_PREFIX = "https://qr.paypay.ne.jp/";
export const MAX_SUPPORT_URL_LENGTH = 200;
// 期限のこの時間前から通知対象にする
export const NOTIFY_BEFORE_MS = 3 * 24 * 60 * 60 * 1000;

const DAY_MS = 24 * 60 * 60 * 1000;

export interface SupportLink {
  url: string;
  /** JSTの有効期限。YYYY-MM-DDTHH:mm:ss+09:00 */
  expires_at: string;
}

export type SupportLinkStatus = "ok" | "expiring" | "expired" | "missing";

// 別ドメインへの誘導や javascript: の埋め込みを防ぐため、パスの文字種まで固定する
const SUPPORT_URL_PATTERN = /^https:\/\/qr\.paypay\.ne\.jp\/[A-Za-z0-9_-]+$/;
const EXPIRES_AT_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T([01]\d|2[0-3]):[0-5]\d:[0-5]\d\+09:00$/;

export function isValidSupportUrl(value: unknown): value is string {
  return typeof value === "string" && value.length <= MAX_SUPPORT_URL_LENGTH && SUPPORT_URL_PATTERN.test(value);
}

// 形式に加え、分解した年月日が同じ日付に戻るかを確認する（2026-02-30 を弾く）
export function isValidExpiresAt(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const m = EXPIRES_AT_PATTERN.exec(value);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d;
}

/**
 * 保存時・読み出し時共通の検証。不正なら null。
 * url と expires_at だけを取り出した新しいオブジェクトを返す。過去日時は拒否しない。
 */
export function validateSupportLink(input: unknown): SupportLink | null {
  if (typeof input !== "object" || input === null || Array.isArray(input)) return null;
  const o = input as Record<string, unknown>;
  if (!isValidSupportUrl(o.url) || !isValidExpiresAt(o.expires_at)) return null;
  return { url: o.url, expires_at: o.expires_at };
}

// JSONファイルの中身から読み出す。壊れていればリンク非表示になるよう null を返す
export function parseSupportLinkJson(raw: string): SupportLink | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    console.warn(`[supportLink] JSONを解析できません: ${e instanceof Error ? e.message : String(e)}`);
    return null;
  }
  const link = validateSupportLink(parsed);
  if (!link) console.warn("[supportLink] 不正な応援リンク設定を無視しました");
  return link;
}

export function isSupportLinkActive(link: SupportLink | null, nowMs: number): boolean {
  return link !== null && nowMs < Date.parse(link.expires_at);
}

export function getSupportLinkStatus(link: SupportLink | null, nowMs: number): SupportLinkStatus {
  if (!link) return "missing";
  const expiresMs = Date.parse(link.expires_at);
  if (nowMs >= expiresMs) return "expired";
  if (expiresMs - nowMs <= NOTIFY_BEFORE_MS) return "expiring";
  return "ok";
}

// 残り日数（切り捨て）。期限を過ぎると負数
export function remainingDays(link: SupportLink, nowMs: number): number {
  return Math.floor((Date.parse(link.expires_at) - nowMs) / DAY_MS);
}

// "2026-09-28T19:57:00+09:00" → "2026-09-28 19:57"
export function formatExpiresJst(expiresAt: string): string {
  return expiresAt.slice(0, 16).replace("T", " ");
}

// datetime-local の値（日本時間として扱う）を expires_at 形式にする。空なら空文字
export function toExpiresAt(localValue: string): string {
  if (!localValue) return "";
  const withSeconds = localValue.length === 16 ? `${localValue}:00` : localValue;
  return `${withSeconds}+09:00`;
}

// expires_at を datetime-local の値にする
export function toDatetimeLocal(expiresAt: string): string {
  return expiresAt.slice(0, 16);
}
