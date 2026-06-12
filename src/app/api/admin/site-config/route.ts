import { NextRequest, NextResponse } from "next/server";
import { checkAdminAuth } from "@/lib/adminAuth";
import { saveDataFile } from "@/lib/adminStore";

export async function PUT(req: NextRequest) {
  const denied = checkAdminAuth(req);
  if (denied) return denied;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: "invalid_json" }, { status: 400 });
  }
  const o = body as Record<string, unknown>;
  if (typeof o.maintenance !== "boolean" || typeof o.maintenance_message !== "string" || o.maintenance_message.length > 500) {
    return NextResponse.json({ success: false, error: "invalid_config" }, { status: 400 });
  }

  const content = JSON.stringify({ maintenance: o.maintenance, maintenance_message: o.maintenance_message }, null, 2) + "\n";
  const result = await saveDataFile("src/data/site_config.json", content);
  if (!result.ok) {
    return NextResponse.json({ success: false, error: "save_failed", detail: result.detail }, { status: 500 });
  }
  return NextResponse.json({ success: true, saved: result.saved, detail: result.detail });
}
