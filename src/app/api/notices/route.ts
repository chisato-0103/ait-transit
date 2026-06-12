import { NextResponse } from "next/server";
import noticesRaw from "@/data/notices.json";

interface Notice {
  id: number;
  date: string;
  title: string;
  body: string;
  type: "info" | "warning" | "alert";
  active: boolean;
}

export async function GET() {
  // 新しい日付が上、同日なら後から追加したもの（id大）が上
  const notices = (noticesRaw as Notice[])
    .filter((n) => n.active)
    .sort((a, b) => (a.date === b.date ? b.id - a.id : b.date.localeCompare(a.date)));
  return NextResponse.json({ success: true, data: notices });
}
