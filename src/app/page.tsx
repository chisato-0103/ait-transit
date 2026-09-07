import type { Metadata } from "next";
import { Suspense } from "react";
import MainClient from "@/components/MainClient";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
  openGraph: { url: "/" },
};

export default function Home() {
  return (
    <Suspense fallback={<div className="loading-screen">読み込み中...</div>}>
      <MainClient />
    </Suspense>
  );
}
