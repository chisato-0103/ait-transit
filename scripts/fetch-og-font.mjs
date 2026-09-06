// OGP画像用フォントのサブセットを取得する。実行: node scripts/fetch-og-font.mjs
// opengraph-image.tsx の文言を変えたら DRAWN_TEXT を更新して再実行すること。
import { writeFile, mkdir } from "node:fs/promises";

// opengraph-image.tsx で実際に描画する文字列をすべて連結したもの
const DRAWN_TEXT =
  "愛工大交通情報システム" +
  "シャトルバス・リニモ・愛知環状鉄道" +
  "次の乗継がすぐ分かる";

const chars = [...new Set(DRAWN_TEXT)].sort().join("");
const cssUrl =
  "https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@700&text=" +
  encodeURIComponent(chars);

// woff2 非対応の古いUAを送るとTrueTypeで返る。satoriはwoff2を読めないため必須
const css = await fetch(cssUrl, {
  headers: { "User-Agent": "Mozilla/4.0" },
}).then((r) => r.text());

const match = css.match(
  /src: url\((https:\/\/fonts\.gstatic\.com[^)]+)\) format\('truetype'\)/
);
if (!match) {
  throw new Error(`TrueTypeのURLを取得できませんでした。返却されたCSS:\n${css}`);
}

const font = await fetch(match[1]).then((r) => r.arrayBuffer());
await mkdir("assets", { recursive: true });
await writeFile("assets/NotoSansJP-Bold-subset.ttf", Buffer.from(font));
console.log(
  `assets/NotoSansJP-Bold-subset.ttf を生成しました (${font.byteLength} bytes)`
);
