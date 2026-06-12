import { promises as fs } from "fs";
import path from "path";

export interface SaveResult {
  ok: boolean;
  saved?: "local" | "github";
  detail: string;
}

// GitHub Contents API でcommitする（Vercel等の読み取り専用FS向け）
async function saveViaGitHub(relPath: string, content: string): Promise<SaveResult> {
  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPO; // 例: chisato-0103/ait-transit
  if (!token || !repo) return { ok: false, detail: "GITHUB_TOKEN/GITHUB_REPO 未設定" };

  const api = `https://api.github.com/repos/${repo}/contents/${relPath}`;
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
      message: `data: 管理画面から ${path.basename(relPath)} を更新`,
      content: Buffer.from(content, "utf-8").toString("base64"),
      sha,
    }),
  });
  if (!res.ok) return { ok: false, detail: `commit失敗 (${res.status})` };
  return { ok: true, saved: "github", detail: "GitHubへcommitしました。自動デプロイ後（数分）に反映されます" };
}

// データファイルを保存する。ローカルFS優先、読み取り専用ならGitHub commitにフォールバック
export async function saveDataFile(relPath: string, content: string): Promise<SaveResult> {
  const absPath = path.join(process.cwd(), relPath);
  try {
    await fs.writeFile(absPath, content, "utf-8");
    return { ok: true, saved: "local", detail: "ローカルに保存しました（git commit & push で公開されます）" };
  } catch {
    return saveViaGitHub(relPath, content);
  }
}

export async function readDataFile(relPath: string, fallback: string): Promise<string> {
  const absPath = path.join(process.cwd(), relPath);
  return fs.readFile(absPath, "utf-8").catch(() => fallback);
}
