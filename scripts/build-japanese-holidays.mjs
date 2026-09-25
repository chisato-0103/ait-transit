// 内閣府「国民の祝日」CSVから src/data/japanese_holidays.json を生成する。
// リニモ・愛環の平日/土休日ダイヤ判定（祝日は土休日扱い）に使う。
// 使い方: node scripts/build-japanese-holidays.mjs [--write]
//   --write を付けたときだけ src/data/japanese_holidays.json を上書きする。
import { readFileSync, writeFileSync } from "fs";

const CSV_URL = "https://www8.cao.go.jp/chosei/shukujitsu/syukujitsu.csv";
const OUT_PATH = "src/data/japanese_holidays.json";
// アプリで扱う年以降だけ収録する（CSVは1955年から載っている）
const FROM_YEAR = 2025;
const UA = "Mozilla/5.0 (compatible; ait-transit-monitor; +https://github.com/chisato-0103/ait-transit)";

async function fetchCsv() {
  const res = await fetch(CSV_URL, { headers: { "User-Agent": UA, Accept: "text/csv,*/*" } });
  if (!res.ok) throw new Error(`CSV取得失敗: HTTP ${res.status}`);
  // 内閣府のCSVは Shift_JIS
  return new TextDecoder("shift_jis").decode(await res.arrayBuffer());
}

// 1行目はヘッダ（国民の祝日・休日月日,国民の祝日・休日名称）
function parse(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== "");
  const header = lines.shift() ?? "";
  if (!header.includes("月日")) throw new Error(`想定外のヘッダ: ${header}`);
  const p = (n) => String(n).padStart(2, "0");
  return lines
    .map((line) => {
      const [date, name] = line.split(",");
      const m = date?.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
      if (!m) throw new Error(`日付を読めない行: ${line}`);
      return { date: `${m[1]}-${p(m[2])}-${p(m[3])}`, name: (name ?? "").trim() };
    })
    .filter((r) => Number(r.date.slice(0, 4)) >= FROM_YEAR)
    .sort((a, b) => a.date.localeCompare(b.date));
}

// 読み違いをそのまま書き込まないための検証
function validate(rows) {
  const errors = [];
  const dates = rows.map((r) => r.date);
  if (new Set(dates).size !== dates.length) errors.push("日付が重複している");
  for (const r of rows) {
    const d = new Date(`${r.date}T00:00:00Z`);
    if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== r.date) errors.push(`実在しない日付: ${r.date}`);
    if (!r.name) errors.push(`名称が空: ${r.date}`);
  }
  // 各年に元日があり、祝日数が妥当（年15〜22日程度）であること
  const years = [...new Set(dates.map((d) => d.slice(0, 4)))];
  for (const y of years) {
    if (!dates.includes(`${y}-01-01`)) errors.push(`${y}年の元日がない`);
    const n = dates.filter((d) => d.startsWith(y)).length;
    if (n < 15 || n > 22) errors.push(`${y}年の祝日数が ${n} 日（想定外）`);
  }
  if (years.length < 2) errors.push(`収録年が ${years.join(",")} のみ`);
  return errors;
}

const rows = parse(await fetchCsv());
const errors = validate(rows);
if (errors.length) {
  console.error("検証に失敗したため書き込みません:");
  for (const e of errors) console.error(`- ${e}`);
  process.exit(1);
}
console.log(`${rows.length}日分を取得: ${rows[0].date} 〜 ${rows.at(-1).date}`);

let before = [];
try {
  before = JSON.parse(readFileSync(OUT_PATH, "utf-8"));
} catch { /* 初回生成 */ }
const beforeMap = new Map(before.map((r) => [r.date, r.name]));
const afterMap = new Map(rows.map((r) => [r.date, r.name]));
const added = rows.filter((r) => beforeMap.get(r.date) !== r.name);
const removed = before.filter((r) => !afterMap.has(r.date));
console.log(`現行との差分: 追加・変更 ${added.length}日 / 削除 ${removed.length}日`);
for (const r of added) console.log(`  + ${r.date} ${r.name}`);
for (const r of removed) console.log(`  - ${r.date} ${r.name}`);

if (process.argv.includes("--write")) {
  writeFileSync(OUT_PATH, JSON.stringify(rows, null, 2) + "\n");
  console.log(`${OUT_PATH} を更新しました`);
} else {
  console.log("（--write を付けると書き込みます）");
}
