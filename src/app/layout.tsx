import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "愛工大交通情報システム",
  description: "愛知工業大学 シャトルバス・リニモ乗り継ぎ案内",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
