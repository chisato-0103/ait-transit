import type { Metadata } from "next";
import { SITE_NAME } from "@/lib/siteMeta";

const TITLE = "お問い合わせ";
const DESCRIPTION =
  "愛工大交通情報システムへのデータの誤りの報告・不具合の報告・機能の要望はこちらから。";

// contact/page.tsx は "use client" のため metadata を持てない。ここで指定する
export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/contact" },
  // openGraph は深いマージをされないため、親の type / locale / siteName も再指定する
  openGraph: {
    type: "website",
    locale: "ja_JP",
    siteName: SITE_NAME,
    title: TITLE,
    description: DESCRIPTION,
    url: "/contact",
  },
};

export default function ContactLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
