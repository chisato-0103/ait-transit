import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { checkAdminAuth } from "@/lib/adminAuth";

interface Notice {
  id: number;
  date: string;
  title: string;
  body: string;
  type: "info" | "warning" | "alert";
  active: boolean;
}

const NOTICES_PATH = path.join(process.cwd(), "src", "data", "notices.json");
const GITHUB_FILE_PATH = "src/data/notices.json";

function validateNotices(input: unknown): Notice[] | null {
  if (!Array.isArray(input) || input.length > 50) return null;
  const out: Notice[] = [];
  for (const n of input) {
    if (typeof n !== "object" || n === null) return null;
    const o = n as Record<string, unknown>;
    if (
      typeof o.id !== "number" ||
      typeof o.date !== "string" ||
      typeof o.title !== "string" || !o.title.trim() || o.title.length > 100 ||
      typeof o.body !== "string" || o.body.length > 1000 ||
      !["info", "warning", "alert"].includes(o.type as string) ||
      typeof o.active !== "boolean"
    ) return null;
    out.push(o as unknown as Notice);
  }
  return out;
}

// GitHub Contents API でcommitする（Vercel等の読み取り専用FS向け）
async function saveViaGitHub(content: string): Promise<{ ok: boolean; detail: string }> {
  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPO; // 例: chisato-0103/ait-transit
  if (!token || !repo) return { ok: false, detail: "GITHUB_TOKEN/GITHUB_REPO 未設定" };

  const api = `https://api.github.com/repos/${repo}/contents/${GITHUB_FILE_PATH}`;
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "Content-Type": "application/json",
  };
  const cur = await fetch(api, { headers });
  if (!cur.ok) return { ok: false, detail: `現行ファイル取得失敗 (${cur.status})` };
  const { sha } = (await cur.json()) as { sha: string };

  const res = await fetch(api, {
    method: "PUT",
    headers,
    body: JSON.stringify({
      message: "data: 管理画面からお知らせを更新",
      content: Buffer.from(content, "utf-8").toString("base64"),
      sha,
    }),
  });
  if (!res.ok) return { ok: false, detail: `commit失敗 (${res.status})` };
  return { ok: true, detail: "GitHubへcommitしました。自動デプロイ後（数分）に反映されます" };
}

export async function GET(req: NextRequest) {
  const denied = checkAdminAuth(req);
  if (denied) return denied;
  // 公開APIと違い、activeでないものも含めて現ファイルから読む
  const raw = await fs.readFile(NOTICES_PATH, "utf-8").catch(() => "[]");
  return NextResponse.json({ success: true, data: JSON.parse(raw) });
}

export async function PUT(req: NextRequest) {
  const denied = checkAdminAuth(req);
  if (denied) return denied;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: "invalid_json" }, { status: 400 });
  }
  const notices = validateNotices(body);
  if (!notices) {
    return NextResponse.json({ success: false, error: "invalid_notices" }, { status: 400 });
  }

  const content = JSON.stringify(notices, null, 2) + "\n";

  // まずローカルFSへ（開発環境）。読み取り専用ならGitHub commitにフォールバック
  try {
    await fs.writeFile(NOTICES_PATH, content, "utf-8");
    return NextResponse.json({ success: true, saved: "local", detail: "ローカルに保存しました（git commit & push で公開されます）" });
  } catch {
    const gh = await saveViaGitHub(content);
    if (gh.ok) return NextResponse.json({ success: true, saved: "github", detail: gh.detail });
    return NextResponse.json({ success: false, error: "save_failed", detail: gh.detail }, { status: 500 });
  }
}
