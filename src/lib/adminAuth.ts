import { NextRequest, NextResponse } from "next/server";

// 管理者APIの認証。ADMIN_PASSWORD 未設定時は管理機能を無効化する
export function checkAdminAuth(req: NextRequest): NextResponse | null {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) {
    return NextResponse.json({ success: false, error: "admin_disabled" }, { status: 503 });
  }
  const token = req.headers.get("x-admin-token");
  if (token !== password) {
    return NextResponse.json({ success: false, error: "unauthorized" }, { status: 401 });
  }
  return null;
}
