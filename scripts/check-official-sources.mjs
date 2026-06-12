// 公式時刻表ソースの変更検知スクリプト
// 各ソースの内容ハッシュを data-source-hashes.json と比較し、
// 変化があれば標準出力に出して GITHUB_OUTPUT にも書き込む。
// 使い方: node scripts/check-official-sources.mjs [--update]
import { createHash } from "crypto";
import { readFileSync, writeFileSync, appendFileSync } from "fs";

const HASH_FILE = "data-source-hashes.json";
const UA = "Mozilla/5.0 (compatible; ait-transit-monitor; +https://github.com/chisato-0103/ait-transit)";

// type:
//  html-tables ... HTML中の<table>だけを正規化してハッシュ（お知らせ等の更新でぶれない）
//  pdf-links   ... ページ中のPDFリンク一覧をハッシュ（改正でファイル名が変わるのを検知）
//  binary      ... ファイルそのもののハッシュ
const SOURCES = [
  { id: "リニモ 八草駅時刻表", url: "https://www.linimo.jp/station/2018030614442117.html", type: "html-tables" },
  { id: "リニモ 藤が丘駅時刻表", url: "https://www.linimo.jp/station/2018030611485318.html", type: "html-tables" },
  { id: "シャトルバス 八草キャンパスページのPDFリンク", url: "https://www.ait.ac.jp/about/yakusa-campus/", type: "pdf-links" },
  { id: "シャトルバス 時刻表PDF", url: "https://www.ait.ac.jp/assets/docs/about/yakusa-campus/access_yakusa_time_20260401.pdf", type: "binary" },
  { id: "愛環 時刻表ページのPDFリンク", url: "https://www.aikanrailway.co.jp/timetable/", type: "pdf-links" },
  { id: "愛環 八草駅PDF", url: "https://www.aikanrailway.co.jp/pdf/timetable/18yakusa_timetable.pdf", type: "binary" },
];

const sha256 = (data) => createHash("sha256").update(data).digest("hex");

async function fetchSource({ url, type }) {
  const res = await fetch(url, { headers: { "User-Agent": UA }, redirect: "follow" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  if (type === "binary") {
    return sha256(Buffer.from(await res.arrayBuffer()));
  }
  const html = await res.text();
  if (type === "html-tables") {
    const tables = (html.match(/<table[\s\S]*?<\/table>/gi) ?? []).join("\n").replace(/\s+/g, " ");
    if (!tables) throw new Error("テーブルが見つからない（ページ構造変更の可能性）");
    return sha256(tables);
  }
  if (type === "pdf-links") {
    const links = [...new Set(html.match(/href="[^"]*\.pdf"/gi) ?? [])].sort().join("\n");
    if (!links) throw new Error("PDFリンクが見つからない（ページ構造変更の可能性）");
    return sha256(links);
  }
  throw new Error(`unknown type: ${type}`);
}

const update = process.argv.includes("--update");
let stored = {};
try {
  stored = JSON.parse(readFileSync(HASH_FILE, "utf-8"));
} catch {
  console.log(`${HASH_FILE} が無いので新規作成します`);
}

const current = {};
const changed = [];
const errors = [];
for (const src of SOURCES) {
  try {
    current[src.id] = await fetchSource(src);
    if (stored[src.id] && stored[src.id] !== current[src.id]) changed.push(src);
  } catch (e) {
    errors.push(`${src.id}: ${e.message}`);
    current[src.id] = stored[src.id] ?? "fetch_failed";
  }
}

if (changed.length) {
  console.log("変更検知:");
  for (const c of changed) console.log(`- ${c.id}\n  ${c.url}`);
}
if (errors.length) {
  console.log("取得エラー:");
  for (const e of errors) console.log(`- ${e}`);
}
if (!changed.length && !errors.length) console.log("変更なし");

if (update || changed.length) {
  writeFileSync(HASH_FILE, JSON.stringify(current, null, 2) + "\n");
}

// GitHub Actions 用の出力
if (process.env.GITHUB_OUTPUT) {
  const body = [
    ...changed.map((c) => `- **${c.id}**\n  ${c.url}`),
    ...errors.map((e) => `- ⚠️ 取得エラー: ${e}`),
  ].join("\n");
  appendFileSync(process.env.GITHUB_OUTPUT, `changed=${changed.length}\n`);
  appendFileSync(process.env.GITHUB_OUTPUT, `errors=${errors.length}\n`);
  appendFileSync(process.env.GITHUB_OUTPUT, `body<<EOF\n${body}\nEOF\n`);
}
