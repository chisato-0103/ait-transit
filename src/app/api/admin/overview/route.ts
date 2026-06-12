import { NextRequest, NextResponse } from "next/server";
import { checkAdminAuth } from "@/lib/adminAuth";
import {
  getDiaType,
  getTodayStr,
  getTomorrowStr,
  DIA_TYPE_DESCRIPTIONS,
} from "@/lib/timetable";
import shuttleRaw from "@/data/shuttle_bus_timetable.json";
import linimoRaw from "@/data/linimo_timetable.json";
import aikanRaw from "@/data/aichi_kanjo_timetable.json";
import scheduleRaw from "@/data/shuttle_schedule.json";
import noticesRaw from "@/data/notices.json";

export async function GET(req: NextRequest) {
  const denied = checkAdminAuth(req);
  if (denied) return denied;

  const today = getTodayStr();
  const tomorrow = getTomorrowStr(today);
  const schedule = scheduleRaw as Array<{ operation_date: string }>;
  const scheduleDates = schedule.map((s) => s.operation_date).sort();
  const notices = noticesRaw as Array<{ active: boolean }>;

  return NextResponse.json({
    success: true,
    data: {
      today,
      today_dia: getDiaType(today),
      today_dia_description: DIA_TYPE_DESCRIPTIONS[getDiaType(today)] ?? "",
      tomorrow_dia: getDiaType(tomorrow),
      tomorrow_dia_description: DIA_TYPE_DESCRIPTIONS[getDiaType(tomorrow)] ?? "",
      datasets: {
        shuttle_bus: (shuttleRaw as unknown[]).length,
        linimo: (linimoRaw as unknown[]).length,
        aichi_kanjo: (aikanRaw as unknown[]).length,
        schedule_days: schedule.length,
        schedule_until: scheduleDates[scheduleDates.length - 1] ?? null,
      },
      notices_total: notices.length,
      notices_active: notices.filter((n) => n.active).length,
      data_sources: {
        linimo: "linimo.jp 駅別時刻表（2026-06-12照合）",
        shuttle: "ait.ac.jp access_yakusa_time_20260401.pdf（令和8年4月1日改正）",
        aichi_kanjo: "aikanrailway.co.jp 駅別PDF（令和8年3月14日改正）",
      },
    },
  });
}
