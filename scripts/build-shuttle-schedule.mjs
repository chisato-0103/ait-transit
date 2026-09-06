// 公式「八草シャトルバス運行日程」PDFから src/data/shuttle_schedule.json を生成する。
// 日付ごとのダイヤ種別（A/B/C/休）はこのPDFだけが公式ソース。
// 時刻表PDF（access_yakusa_time_*.pdf）は便の時刻であって運行日ではないので混同しないこと。
// 使い方: node scripts/build-shuttle-schedule.mjs [--write]
//   --write を付けたときだけ src/data/shuttle_schedule.json を上書きする。
// pdftotext（poppler）が必要。
import { execFileSync } from "child_process";
import { readFileSync, writeFileSync, mkdtempSync } from "fs";
import { tmpdir } from "os";
import path from "path";

const PDF_URL = "https://www.ait.ac.jp/assets/docs/about/yakusa-campus/access_yakusa20260114.pdf";
const OUT_PATH = "src/data/shuttle_schedule.json";
const FISCAL_YEAR = 2026; // 令和8年度 = 2026-04-01〜2027-03-31
const UA = "Mozilla/5.0 (compatible; ait-transit-monitor; +https://github.com/chisato-0103/ait-transit)";

async function fetchPdfText() {
  const res = await fetch(PDF_URL, { headers: { "User-Agent": UA, Accept: "application/pdf,*/*" } });
  if (!res.ok) throw new Error(`PDF取得失敗: HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (!buf.subarray(0, 5).toString("latin1").startsWith("%PDF")) {
    throw new Error("PDFでない応答（bot対策等の可能性）");
  }
  const dir = mkdtempSync(path.join(tmpdir(), "ait-schedule-"));
  const pdf = path.join(dir, "schedule.pdf");
  const txt = path.join(dir, "schedule.txt");
  writeFileSync(pdf, buf);
  try {
    execFileSync("pdftotext", ["-layout", pdf, txt]);
  } catch {
    throw new Error("pdftotext が必要です（brew install poppler）");
  }
  return readFileSync(txt, "utf-8");
}

// 「日 ダイヤ」のペアを左上から順に読み、4/1から日付を割り当てる
function parse(text) {
  const pairs = [...text.matchAll(/(\d{1,2})\s+(A|B|C|休)/g)].map((m) => [Number(m[1]), m[2]]);
  const out = [];
  let year = FISCAL_YEAR;
  let month = 4;
  let prevDay = 0;
  for (const [day, mark] of pairs) {
    if (day < prevDay) {
      month += 1;
      if (month === 13) { month = 1; year += 1; }
    }
    prevDay = day;
    const p = (n) => String(n).padStart(2, "0");
    out.push({
      operation_date: `${year}-${p(month)}-${p(day)}`,
      dia_type: mark === "休" ? "holiday" : mark,
      fiscal_year: FISCAL_YEAR,
    });
  }
  return out;
}

// 読み違いをそのまま書き込まないための検証
function validate(rows) {
  const errors = [];
  if (rows.length !== 365 && rows.length !== 366) errors.push(`日数が ${rows.length} 件（365/366のはず）`);

  const dates = rows.map((r) => r.operation_date);
  if (new Set(dates).size !== dates.length) errors.push("日付が重複している");

  const first = `${FISCAL_YEAR}-04-01`;
  if (dates[0] !== first) errors.push(`開始が ${dates[0]}（${first} のはず）`);

  for (let i = 0; i < dates.length; i++) {
    const d = new Date(`${dates[i]}T00:00:00Z`);
    if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== dates[i]) {
      errors.push(`実在しない日付: ${dates[i]}`);
      continue;
    }
    if (i > 0) {
      const prev = new Date(`${dates[i - 1]}T00:00:00Z`);
      if (d - prev !== 86400000) errors.push(`日付が連続していない: ${dates[i - 1]} → ${dates[i]}`);
    }
  }
  const kinds = new Set(rows.map((r) => r.dia_type));
  for (const k of kinds) {
    if (!["A", "B", "C", "holiday"].includes(k)) errors.push(`未知のダイヤ種別: ${k}`);
  }
  return errors;
}

const text = await fetchPdfText();
const rows = parse(text);
const errors = validate(rows);
if (errors.length) {
  console.error("検証に失敗したため書き込みません:");
  for (const e of errors) console.error(`- ${e}`);
  process.exit(1);
}

const counts = rows.reduce((a, r) => ({ ...a, [r.dia_type]: (a[r.dia_type] ?? 0) + 1 }), {});
console.log(`${rows.length}日分を取得: ${JSON.stringify(counts)}`);

let before = [];
try {
  before = JSON.parse(readFileSync(OUT_PATH, "utf-8"));
} catch { /* 初回生成 */ }
const beforeMap = new Map(before.map((r) => [r.operation_date, r.dia_type]));
const diff = rows.filter((r) => beforeMap.get(r.operation_date) !== r.dia_type);
console.log(`現行との差分: ${diff.length}日`);
for (const r of diff) {
  console.log(`  ${r.operation_date} ${beforeMap.get(r.operation_date) ?? "(なし)"} → ${r.dia_type}`);
}

if (process.argv.includes("--write")) {
  writeFileSync(OUT_PATH, JSON.stringify(rows, null, 2) + "\n");
  console.log(`${OUT_PATH} を更新しました`);
} else {
  console.log("（--write を付けると書き込みます）");
}
