import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "愛工大交通情報システム";

// 文言を変えたら scripts/fetch-og-font.mjs の DRAWN_TEXT も更新して再実行すること
const TITLE = "愛工大交通情報システム";
const SUBTITLE = "シャトルバス・リニモ・愛知環状鉄道";
const TAGLINE = "次の乗継がすぐ分かる";

export default async function Image() {
  const font = await readFile(
    join(process.cwd(), "assets/NotoSansJP-Bold-subset.ttf")
  );

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #0066cc 0%, #004a94 100%)",
          color: "#ffffff",
        }}
      >
        <div style={{ fontSize: 76, letterSpacing: "0.02em" }}>{TITLE}</div>
        <div style={{ fontSize: 36, marginTop: 32, opacity: 0.95 }}>
          {SUBTITLE}
        </div>
        <div style={{ fontSize: 30, marginTop: 20, opacity: 0.8 }}>
          {TAGLINE}
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        {
          name: "Noto Sans JP",
          data: font,
          weight: 700,
          style: "normal",
        },
      ],
    }
  );
}
