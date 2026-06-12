import { NextRequest, NextResponse } from "next/server";

const CATEGORIES = ["データの誤りの報告", "不具合の報告", "機能の要望", "その他"] as const;

// FormspreeのIDはサーバー側でのみ保持する（クライアントに露出させない）
const FORMSPREE_ID = process.env.FORMSPREE_ID ?? process.env.NEXT_PUBLIC_FORMSPREE_ID;

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: "invalid_json" }, { status: 400 });
  }

  const name = String(body.name ?? "").trim().slice(0, 100);
  const email = String(body.email ?? "").trim().slice(0, 200);
  const category = String(body.category ?? "");
  const message = String(body.message ?? "").trim();
  const honeypot = String(body.website ?? "");

  // ハニーポット: botには成功を装って捨てる
  if (honeypot) return NextResponse.json({ success: true });

  if (!CATEGORIES.includes(category as (typeof CATEGORIES)[number])) {
    return NextResponse.json({ success: false, error: "invalid_category" }, { status: 400 });
  }
  if (message.length < 10 || message.length > 2000) {
    return NextResponse.json({ success: false, error: "invalid_message" }, { status: 400 });
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ success: false, error: "invalid_email" }, { status: 400 });
  }

  if (!FORMSPREE_ID || FORMSPREE_ID === "YOUR_FORM_ID") {
    return NextResponse.json({ success: false, error: "not_configured" }, { status: 503 });
  }

  const res = await fetch(`https://formspree.io/f/${FORMSPREE_ID}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      name: name || "（未記入）",
      email: email || undefined,
      category,
      message,
      _subject: `[ait-transit] ${category}`,
    }),
  });

  if (!res.ok) {
    return NextResponse.json({ success: false, error: "upstream_error" }, { status: 502 });
  }
  return NextResponse.json({ success: true });
}
