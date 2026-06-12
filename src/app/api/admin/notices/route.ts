import { NextRequest, NextResponse } from "next/server";
import { checkAdminAuth } from "@/lib/adminAuth";
import { saveDataFile, readDataFile } from "@/lib/adminStore";

interface Notice {
  id: number;
  date: string;
  title: string;
  body: string;
  type: "info" | "warning" | "alert";
  active: boolean;
}

const NOTICES_REL_PATH = "src/data/notices.json";

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

export async function GET(req: NextRequest) {
  const denied = checkAdminAuth(req);
  if (denied) return denied;
  // 公開APIと違い、activeでないものも含めて現ファイルから読む
  const raw = await readDataFile(NOTICES_REL_PATH, "[]");
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
  const result = await saveDataFile(NOTICES_REL_PATH, content);
  if (!result.ok) {
    return NextResponse.json({ success: false, error: "save_failed", detail: result.detail }, { status: 500 });
  }
  return NextResponse.json({ success: true, saved: result.saved, detail: result.detail });
}
