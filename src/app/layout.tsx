import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/react";
import { getSiteUrl } from "@/lib/siteUrl";
import "./globals.css";

const SITE_NAME = "愛工大交通情報システム";

// 検索結果とSNS共有の両方で使う説明文
const DESCRIPTION =
  "愛知工業大学のシャトルバス・リニモ・愛知環状鉄道の時刻表と乗継案内。八草キャンパスから藤が丘・高蔵寺・岡崎方面への次の乗継をすぐ確認できます。";

// 検索されうる語を先頭に置く。Googleは前方の語を重視し、
// ユーザーも検索結果の先頭しか読まないため
const TITLE = "愛工大 シャトルバス・リニモ・愛環 乗継案内";

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: {
    default: `${TITLE} | ${SITE_NAME}`,
    template: `%s | ${SITE_NAME}`,
  },
  description: DESCRIPTION,
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "ja_JP",
    siteName: SITE_NAME,
    title: TITLE,
    description: DESCRIPTION,
    url: "/",
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
