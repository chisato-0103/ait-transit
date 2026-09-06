import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // OGP画像の生成時に読むフォントを、デプロイ成果物に確実に含める
  outputFileTracingIncludes: {
    "/opengraph-image": ["./assets/**"],
  },
};

export default nextConfig;
