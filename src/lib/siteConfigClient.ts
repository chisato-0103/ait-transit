import type { SupportLink } from "./supportLink";

// サイト設定（メンテナンスモード・応援リンク）。/api/site-config の応答の data
export interface SiteConfig {
  maintenance: boolean;
  maintenance_message: string;
  support_link?: SupportLink | null;
}

// 本番の /api/site-config は毎回 GitHub から読み直すため、
// MainClient とフッターが別々に取得すると 1 回の表示で 2 回 GitHub を読むことになる。
// ページ内で 1 回だけ取得し、同じ Promise を共有する
let cached: Promise<SiteConfig | null> | null = null;

export function loadSiteConfig(fetcher: typeof fetch = fetch): Promise<SiteConfig | null> {
  if (!cached) {
    cached = fetcher("/api/site-config")
      .then((r) => r.json())
      .then((j: { data?: SiteConfig }) => j.data ?? null)
      .catch((e: unknown) => {
        // 取得できなくてもアプリは動かす（メンテナンスなし・応援リンク非表示として扱う）
        console.warn("サイト設定の取得に失敗しました", e);
        return null;
      });
  }
  return cached;
}

export function resetSiteConfigCacheForTest(): void {
  cached = null;
}
