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
  const notices = (noticesRaw as Notice[]).filter((n) => n.active);
  return NextResponse.json({ success: true, data: notices });
}
