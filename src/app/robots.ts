import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/siteUrl";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // /admin はパスワード保護済みだが、ログイン画面が検索結果に出るのを防ぐ。
      // /api はクローラが叩いても意味がない
      disallow: ["/admin", "/api/"],
    },
    sitemap: `${getSiteUrl()}/sitemap.xml`,
  };
}
