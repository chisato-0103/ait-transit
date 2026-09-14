import { NextResponse } from "next/server";
import { readDataFile } from "@/lib/adminStore";
import { SUPPORT_LINK_REL_PATH, parseSupportLinkJson } from "@/lib/supportLink";
import defaultConfig from "@/data/site_config.json";
import defaultSupportLink from "@/data/support_link.json";

// 既存の設定がオブジェクトとして読めなければ同梱の既定値に倒す
function parseConfig(raw: string): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // 壊れたJSONは既定値で動かす（従来と同じ挙動）
  }
  return defaultConfig;
}

// サイト設定（メンテナンスモード・応援リンク等）。公開API
// 応援リンクの期限切れ判定はクライアントの現在時刻で行うため、ここでは期限で絞らない
export async function GET() {
  const [configRaw, supportRaw] = await Promise.all([
    readDataFile("src/data/site_config.json", JSON.stringify(defaultConfig)),
    readDataFile(SUPPORT_LINK_REL_PATH, JSON.stringify(defaultSupportLink)),
  ]);
  return NextResponse.json({
    success: true,
    data: { ...parseConfig(configRaw), support_link: parseSupportLinkJson(supportRaw) },
  });
}
