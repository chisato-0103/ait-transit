import type { Metadata } from "next";
import { BASE_OPEN_GRAPH, BASE_TWITTER } from "@/lib/siteMeta";

const TITLE = "お問い合わせ";
const DESCRIPTION =
  "愛工大交通情報システムへのデータの誤りの報告・不具合の報告・機能の要望はこちらから。";

// contact/page.tsx は "use client" のため metadata を持てない。ここで指定する
export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/contact" },
  // openGraph / twitter は深いマージをされないため、基底を展開して共通属性を維持する
  openGraph: {
    ...BASE_OPEN_GRAPH,
    title: TITLE,
    description: DESCRIPTION,
    url: "/contact",
  },
  twitter: {
    ...BASE_TWITTER,
    title: TITLE,
    description: DESCRIPTION,
  },
};

export default function ContactLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
