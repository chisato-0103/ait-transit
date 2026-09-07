import type { Metadata } from "next";

// robots.ts でクロール自体を止めているが、外部リンク経由で到達された場合に
// 備えて noindex も指定する（役割が異なるため両方必要）
export const metadata: Metadata = {
  title: "管理画面",
  robots: { index: false, follow: false },
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
