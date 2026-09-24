import type { Metadata } from "next";
import { Suspense } from "react";
import MainClient from "@/components/MainClient";
import ShuttleTimetableSection from "@/components/ShuttleTimetableSection";
import SiteFooter from "@/components/SiteFooter";
import { BASE_OPEN_GRAPH, TITLE, DESCRIPTION, SITE_NAME } from "@/lib/siteMeta";
import { getSiteUrl } from "@/lib/siteUrl";

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

// 検索結果のサイト名表示を安定させるための構造化データ。値はすべて定数から作る
const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: SITE_NAME,
  url: `${getSiteUrl()}/`,
};

export default function Home() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
      <Suspense fallback={<div className="loading-screen">読み込み中...</div>}>
        <MainClient />
      </Suspense>
      <ShuttleTimetableSection />
      <SiteFooter />
    </>
  );
}
