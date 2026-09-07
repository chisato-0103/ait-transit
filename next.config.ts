import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // OGP画像の生成時に読むフォントを、デプロイ成果物に確実に含める
  outputFileTracingIncludes: {
    "/opengraph-image": ["./assets/**"],
  },
  // APIのJSON自体が検索結果に出るのを防ぐ。robots.txt でクロールを止めると
  // トップページの本文（APIのfetch結果）がGoogleに読まれなくなるため、
  // クロールは通したうえでインデックスだけ除外する
  async headers() {
    return [
      {
        source: "/api/:path*",
        headers: [{ key: "X-Robots-Tag", value: "noindex" }],
      },
    ];
  },
};

export default nextConfig;
