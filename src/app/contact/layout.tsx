import type { Metadata } from "next";

// contact/page.tsx は "use client" のため metadata を持てない。ここで指定する
export const metadata: Metadata = {
  title: "お問い合わせ",
  description:
    "愛工大交通情報システムへのデータの誤りの報告・不具合の報告・機能の要望はこちらから。",
  alternates: { canonical: "/contact" },
};

export default function ContactLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
