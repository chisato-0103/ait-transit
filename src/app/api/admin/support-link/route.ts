import { NextRequest, NextResponse } from "next/server";
import { checkAdminAuth } from "@/lib/adminAuth";
import { saveDataFile } from "@/lib/adminStore";
import { SUPPORT_LINK_REL_PATH, validateSupportLink } from "@/lib/supportLink";

export async function PUT(req: NextRequest) {
  const denied = checkAdminAuth(req);
  if (denied) return denied;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: "invalid_json" }, { status: 400 });
  }

  const link = validateSupportLink(body);
  if (!link) {
    return NextResponse.json({ success: false, error: "invalid_support_link" }, { status: 400 });
  }

  try {
    const result = await saveDataFile(SUPPORT_LINK_REL_PATH, JSON.stringify(link, null, 2) + "\n");
    if (!result.ok) {
      return NextResponse.json({ success: false, error: "save_failed", detail: result.detail }, { status: 500 });
    }
    return NextResponse.json({ success: true, saved: result.saved, detail: result.detail });
  } catch (e) {
    // GitHub API のネットワーク障害等で saveDataFile が例外を投げても JSON で返す
    const message = e instanceof Error ? e.message : String(e);
    console.error(`[support-link] 保存中にエラー: ${message}`);
    return NextResponse.json({ success: false, error: "save_failed", detail: `保存中にエラー: ${message}` }, { status: 500 });
  }
}
