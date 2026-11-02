import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { emailMode } from "@/lib/config";
import { q } from "@/lib/db";
import { subscribe } from "@/lib/subscribers";

export const dynamic = "force-dynamic";

function authed(req: Request) {
  const tok = process.env.INGEST_TOKEN || "";
  const got = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  return !!tok && got.length === tok.length && timingSafeEqual(Buffer.from(got), Buffer.from(tok));
}

/** Owner-only. GET: counts by status. POST: send confirmation emails to pending sign-ups that never got one (max 50 per call). */
export async function GET(req: Request) {
  if (!authed(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const rows = await q<any>("SELECT status, (confirm_sent_at IS NULL) AS unsent, COUNT(*) AS n FROM subscribers GROUP BY status, unsent");
  return NextResponse.json({ email_provider: emailMode(), counts: rows }, { headers: { "cache-control": "no-store" } });
}

export async function POST(req: Request) {
  if (!authed(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (emailMode() !== "resend") return NextResponse.json({ error: "RESEND_API_KEY is not set; nothing sent" }, { status: 409 });
  const rows = await q<any>("SELECT email, source FROM subscribers WHERE status='pending' AND confirm_sent_at IS NULL ORDER BY created_at LIMIT 50");
  let sent = 0, failed = 0;
  for (const r of rows) ((await subscribe(String(r.email), String(r.source || "other"))).status === "sent" ? sent++ : failed++);
  return NextResponse.json({ sent, failed, remaining_checked: rows.length });
}
