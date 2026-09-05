/**
 * シャトルの臨時ダイヤ上書きの読み書き。
 * 誤ったダイヤを1リクエストでも返さないよう、Next.jsのfetchキャッシュ
 * （revalidateTagはstale-while-revalidate挙動）ではなく
 * TTL付きのメモリキャッシュを使い、期限が切れたら必ず取り直す。
 */
import { promises as fs } from "fs";
import path from "path";
import fallbackRaw from "@/data/shuttle_dia_overrides.json";
import { isDiaType, type DiaOverride } from "@/lib/timetable";

export const DIA_OVERRIDES_REL_PATH = "src/data/shuttle_dia_overrides.json";

export const MAX_OVERRIDES = 100;
export const MAX_MEMO_LENGTH = 100;

const CACHE_TTL_MS = 30_000;
// 取得に失敗した直後は短い間隔で取り直す
const STALE_RETRY_MS = 10_000;
const FETCH_TIMEOUT_MS = 5_000;

export interface DiaOverrideSource {
  overrides: DiaOverride[];
  /** local=開発環境のFS / github=本番の最新 / stale=取得失敗で直前の取得値 / fallback=取得できずビルド同梱値 */
  source: "local" | "github" | "stale" | "fallback";
  fetched_at: string | null;
}

interface CacheEntry {
  overrides: DiaOverride[];
  source: DiaOverrideSource["source"];
  fetchedAt: string;
  expiresAt: number;
  etag: string | null;
}

let cache: CacheEntry | null = null;

/**
 * キャッシュを期限切れにして次回必ず取り直させる。
 * 内容は捨てない。取り直しに失敗したときの拠り所として直前の取得値を残す。
 */
export function expireDiaOverridesCache(): void {
  if (cache) cache = { ...cache, expiresAt: 0 };
}

// JSTの現在時刻を +09:00 付きISO8601で返す
export function nowJstIso(): string {
  const d = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}T${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}+09:00`;
}

// YYYY-MM-DD の形式に加え、分解して同じ年月日に戻るかを確認する（2026-02-30 を弾く）
export function isValidDateStr(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

/**
 * 保存時の検証。1件でも不正なら null を返し、呼び出し側は何も保存しない。
 * updated_at はサーバー側で付け直すため、入力値は採用しない。
 */
export function validateDiaOverrides(input: unknown): DiaOverride[] | null {
  if (!Array.isArray(input) || input.length > MAX_OVERRIDES) return null;

  const savedAt = nowJstIso();
  const out: DiaOverride[] = [];
  const seen = new Set<string>();
  for (const item of input) {
    if (typeof item !== "object" || item === null) return null;
    const o = item as Record<string, unknown>;

    if (!isValidDateStr(o.operation_date)) return null;
    if (!isDiaType(o.dia_type)) return null;
    if (seen.has(o.operation_date)) return null;
    seen.add(o.operation_date);

    let memo: string | undefined;
    if (o.memo !== undefined && o.memo !== null && o.memo !== "") {
      if (typeof o.memo !== "string" || Array.from(o.memo).length > MAX_MEMO_LENGTH) return null;
      memo = o.memo;
    }

    out.push({
      operation_date: o.operation_date,
      dia_type: o.dia_type,
      ...(memo ? { memo } : {}),
      updated_at: savedAt,
    });
  }
  out.sort((a, b) => a.operation_date.localeCompare(b.operation_date));
  return out;
}

/**
 * 読み出し時の検証。手作業でJSONを編集した場合の保険として、
 * 壊れた行だけを捨てて残りを使う。日付が重複していたら先頭を採用する。
 */
export function sanitizeDiaOverrides(input: unknown): DiaOverride[] {
  if (!Array.isArray(input)) {
    console.warn("[diaOverrides] 配列ではないデータを無視しました");
    return [];
  }
  const out: DiaOverride[] = [];
  const seen = new Set<string>();
  for (const item of input) {
    if (typeof item !== "object" || item === null) continue;
    const o = item as Record<string, unknown>;
    if (!isValidDateStr(o.operation_date) || !isDiaType(o.dia_type)) {
      console.warn(`[diaOverrides] 不正な行を無視しました: ${JSON.stringify(item)}`);
      continue;
    }
    if (seen.has(o.operation_date)) {
      console.warn(`[diaOverrides] 日付が重複しています。先頭を採用します: ${o.operation_date}`);
      continue;
    }
    seen.add(o.operation_date);
    const memo = typeof o.memo === "string" && o.memo ? Array.from(o.memo).slice(0, MAX_MEMO_LENGTH).join("") : undefined;
    out.push({
      operation_date: o.operation_date,
      dia_type: o.dia_type,
      ...(memo ? { memo } : {}),
      updated_at: typeof o.updated_at === "string" ? o.updated_at : "",
    });
  }
  out.sort((a, b) => a.operation_date.localeCompare(b.operation_date));
  return out.slice(0, MAX_OVERRIDES);
}

function fallback(): DiaOverrideSource {
  return { overrides: sanitizeDiaOverrides(fallbackRaw), source: "fallback", fetched_at: null };
}

// GitHub Contents API から最新を取る。304 のときは null を返して呼び出し側でキャッシュを継続利用する
async function fetchFromGitHub(etag: string | null): Promise<{ overrides: DiaOverride[]; etag: string | null } | "not_modified" | null> {
  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPO;
  if (!token || !repo) {
    console.warn("[diaOverrides] GITHUB_TOKEN/GITHUB_REPO 未設定のため同梱データを使います");
    return null;
  }

  const url = `https://api.github.com/repos/${repo}/contents/${DIA_OVERRIDES_REL_PATH}?ref=main`;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
  };
  if (etag) headers["If-None-Match"] = etag;

  try {
    const res = await fetch(url, { headers, cache: "no-store", signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
    if (res.status === 304) return "not_modified";
    if (!res.ok) {
      console.warn(`[diaOverrides] GitHub取得失敗 (${res.status})`);
      return null;
    }
    const json = (await res.json()) as { type?: string; content?: string };
    if (json.type !== "file" || typeof json.content !== "string") {
      console.warn("[diaOverrides] GitHubレスポンスがファイルではありません");
      return null;
    }
    const decoded = Buffer.from(json.content, "base64").toString("utf-8");
    return { overrides: sanitizeDiaOverrides(JSON.parse(decoded)), etag: res.headers.get("etag") };
  } catch (e) {
    console.warn(`[diaOverrides] GitHub取得エラー: ${e instanceof Error ? e.message : String(e)}`);
    return null;
  }
}

/**
 * 現在有効な上書きを返す。
 * ローカル開発はFSから毎回、Vercel上はGitHub APIから最大30秒のキャッシュ付きで取得する。
 * ビルド同梱のJSONを直接読むと更新が反映されないため、フォールバック時のみ使う。
 */
export async function getDiaOverrides(): Promise<DiaOverrideSource> {
  if (!process.env.VERCEL) {
    try {
      const raw = await fs.readFile(path.join(process.cwd(), DIA_OVERRIDES_REL_PATH), "utf-8");
      return { overrides: sanitizeDiaOverrides(JSON.parse(raw)), source: "local", fetched_at: nowJstIso() };
    } catch (e) {
      console.warn(`[diaOverrides] ローカル読み込み失敗: ${e instanceof Error ? e.message : String(e)}`);
      return fallback();
    }
  }

  if (cache && Date.now() < cache.expiresAt) {
    return { overrides: cache.overrides, source: cache.source, fetched_at: cache.fetchedAt };
  }

  const result = await fetchFromGitHub(cache?.etag ?? null);
  if (result === null) {
    // 取得に失敗しても直前に取れた上書きは捨てない。
    // ビルド同梱データに戻すと、反映済みの緊急変更が取り消されて誤ったダイヤを表示してしまう
    if (!cache) return fallback();
    cache = { ...cache, source: "stale", expiresAt: Date.now() + STALE_RETRY_MS };
    return { overrides: cache.overrides, source: "stale", fetched_at: cache.fetchedAt };
  }

  if (result === "not_modified") {
    // 内容に変化なし。取得できたので stale から復帰させ、期限だけ延ばす
    if (!cache) return fallback();
    cache = { ...cache, source: "github", expiresAt: Date.now() + CACHE_TTL_MS, fetchedAt: nowJstIso() };
  } else {
    cache = {
      overrides: result.overrides,
      source: "github",
      fetchedAt: nowJstIso(),
      expiresAt: Date.now() + CACHE_TTL_MS,
      etag: result.etag,
    };
  }
  return { overrides: cache.overrides, source: cache.source, fetched_at: cache.fetchedAt };
}
