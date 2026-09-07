import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/siteUrl";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // /admin はパスワード保護済みだが、ログイン画面が検索結果に出るのを防ぐ。
      // /api はレンダリングに必要なため通し、インデックス除外は
      // next.config.ts の X-Robots-Tag ヘッダで行う（クロールを止めると本文が読まれなくなる）
      disallow: ["/admin", "/api/admin/"],
    },
    sitemap: `${getSiteUrl()}/sitemap.xml`,
  };
}
