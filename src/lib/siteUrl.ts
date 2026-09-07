// サイトの絶対URLを解決する。metadata / robots / sitemap / OGP画像から参照される。
// 独自ドメインを取得したら Vercel に NEXT_PUBLIC_SITE_URL を設定するだけでよい。
export function getSiteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit) return explicit.replace(/\/+$/, "");

  // Vercel が本番デプロイに自動注入する。プロトコルは含まれない
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (vercel) return `https://${vercel}`;

  return "http://localhost:3000";
}
