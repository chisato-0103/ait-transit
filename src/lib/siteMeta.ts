// サイト共通のメタデータ定数
export const SITE_NAME = "愛工大交通情報システム";

// トップページの説明文。検索結果とSNS共有の両方で使う
export const DESCRIPTION =
  "愛知工業大学のシャトルバス・リニモ・愛知環状鉄道の時刻表と乗継案内。八草キャンパスから藤が丘・高蔵寺・岡崎方面への次の乗継をすぐ確認できます。";

// 検索されうる語を先頭に置く。Googleは前方の語を重視し、
// ユーザーも検索結果の先頭しか読まないため
export const TITLE = "愛工大 シャトルバス・リニモ・愛環 乗継案内";

// OGP画像。src/app/opengraph-image.tsx が生成するものを指す
const OG_IMAGE = {
  url: "/opengraph-image",
  width: 1200,
  height: 630,
  alt: SITE_NAME,
};

// Next.js の openGraph / twitter は深いマージをしない。
// 子ページで上書きするときは必ずこの基底を展開し、
// 共通属性（type / locale / siteName / images）が消えないようにすること
export const BASE_OPEN_GRAPH = {
  type: "website" as const,
  locale: "ja_JP",
  siteName: SITE_NAME,
  images: [OG_IMAGE],
};

export const BASE_TWITTER = {
  card: "summary_large_image" as const,
  images: [OG_IMAGE],
};
