import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/react";
import { getSiteUrl } from "@/lib/siteUrl";
import { SITE_NAME, DESCRIPTION, TITLE, BASE_OPEN_GRAPH, BASE_TWITTER } from "@/lib/siteMeta";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: {
    // トップページはサイト名を付けない。Googleが検索結果で
    // 「愛工大交通情報システム: 」を自動で前置するため、
    // 自分でも付けると名前が重複して表示文字数(全角30文字前後)を超え、
    // 末尾の「乗継案内」が省略されてしまう
    default: TITLE,
    // 子ページは自分のタイトルだけでは何のサイトか分からないため付ける
    template: `%s | ${SITE_NAME}`,
  },
  description: DESCRIPTION,
  // Google Search Console の所有権確認タグ。削除すると所有権が外れるため残すこと
  verification: { google: "e30V6tWlyYjoqWdz6fJXdnPjuhneL5hngZ4Y1lqvoEI" },
  // canonical と openGraph.url はURL固有のため各ページ側で指定する
  openGraph: {
    ...BASE_OPEN_GRAPH,
    title: TITLE,
    description: DESCRIPTION,
  },
  twitter: {
    ...BASE_TWITTER,
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
