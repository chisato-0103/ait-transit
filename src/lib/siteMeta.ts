import type { Metadata } from "next";

// サイト共通のメタデータ定数
export const SITE_NAME = "愛工大交通情報システム";

// トップページの説明文。検索結果とSNS共有の両方で使う。
// 検索語を前半に置く。Googleは前方の語を重視し、検索結果でも後半は省略されやすいため
export const DESCRIPTION =
  "愛知工業大学の無料シャトルバス（八草駅⇔八草キャンパス）の時刻表と次の便をすぐ確認。リニモ・愛知環状鉄道との乗継も案内します。";

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
// 共通属性（type / locale / siteName / images）が消えないようにすること。
// satisfies を付けているのはプロパティ名の打ち間違いを tsc に検出させるため
// （スプレッド経由だと余剰プロパティチェックが効かず、静かに欠落する）
export const BASE_OPEN_GRAPH = {
  type: "website",
  locale: "ja_JP",
  siteName: SITE_NAME,
  images: [OG_IMAGE],
} satisfies NonNullable<Metadata["openGraph"]>;

export const BASE_TWITTER = {
  card: "summary_large_image",
  images: [OG_IMAGE],
} satisfies NonNullable<Metadata["twitter"]>;
