import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/siteUrl";

export default function sitemap(): MetadataRoute.Sitemap {
  const siteUrl = getSiteUrl();

  // lastModified は入れない。ビルドのたびに更新日が変わり、
  // 実際は更新していないのに更新扱いになってGoogleに信用されなくなるため
  // /admin は検索対象外のため載せない
  return [
    {
      url: `${siteUrl}/`,
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${siteUrl}/contact`,
      changeFrequency: "yearly",
      priority: 0.5,
    },
  ];
}
