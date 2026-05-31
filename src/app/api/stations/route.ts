import { NextResponse } from "next/server";
import { getAllStations } from "@/lib/timetable";

export async function GET() {
  const stations = getAllStations();
  return NextResponse.json({ success: true, data: stations });
}
