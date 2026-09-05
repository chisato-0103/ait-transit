import { NextRequest, NextResponse } from "next/server";
import { checkAdminAuth } from "@/lib/adminAuth";
import { saveDataFile } from "@/lib/adminStore";
import {
  getDiaOverrides,
  validateDiaOverrides,
  expireDiaOverridesCache,
  DIA_OVERRIDES_REL_PATH,
} from "@/lib/diaOverrides";

export async function GET(req: NextRequest) {
  const denied = checkAdminAuth(req);
  if (denied) return denied;

  const { overrides, source, fetched_at } = await getDiaOverrides();
  return NextResponse.json({ success: true, data: overrides, source, fetched_at });
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

  const overrides = validateDiaOverrides(body);
  if (!overrides) {
    return NextResponse.json({ success: false, error: "invalid_overrides" }, { status: 400 });
  }

  const content = JSON.stringify(overrides, null, 2) + "\n";
  const result = await saveDataFile(DIA_OVERRIDES_REL_PATH, content);
  if (!result.ok) {
    return NextResponse.json({ success: false, error: "save_failed", detail: result.detail }, { status: 500 });
  }

  // 保存直後は必ず取り直させる。saveDataFile の文言は自動デプロイ前提なのでここでは使わない
  expireDiaOverridesCache();
  const detail =
    result.saved === "github"
      ? "保存しました。30秒以内に反映されます"
      : "ローカルに保存しました（開発環境では即時反映されます）";
  return NextResponse.json({ success: true, saved: result.saved, detail });
}
