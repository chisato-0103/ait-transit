import type { Metadata } from "next";
import { Suspense } from "react";
import MainClient from "@/components/MainClient";
import { BASE_OPEN_GRAPH, TITLE, DESCRIPTION } from "@/lib/siteMeta";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
  // openGraph は深いマージをされないため、基底を展開して共通属性を維持する
  openGraph: {
    ...BASE_OPEN_GRAPH,
    title: TITLE,
    description: DESCRIPTION,
    url: "/",
  },
};

export default function Home() {
  return (
    <Suspense fallback={<div className="loading-screen">読み込み中...</div>}>
      <MainClient />
    </Suspense>
  );
}
