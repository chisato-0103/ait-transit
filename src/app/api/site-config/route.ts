import { NextResponse } from "next/server";
import { readDataFile } from "@/lib/adminStore";
import defaultConfig from "@/data/site_config.json";

// サイト設定（メンテナンスモード等）。公開API
export async function GET() {
  const raw = await readDataFile("src/data/site_config.json", JSON.stringify(defaultConfig));
  try {
    return NextResponse.json({ success: true, data: JSON.parse(raw) });
  } catch {
    return NextResponse.json({ success: true, data: defaultConfig });
  }
}
