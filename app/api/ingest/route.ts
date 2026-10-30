import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { kvSet } from "@/lib/db";

/** Box -> production push: { bundle?, traces?, spend? }. Bearer INGEST_TOKEN. Hold-out filtering is re-applied on read. */
export async function POST(req: Request) {
  const tok = process.env.INGEST_TOKEN || "";
  const got = (req.headers.get("authorization") || "").replace(/^Bearer /, "");
  if (!tok || got.length !== tok.length || !timingSafeEqual(Buffer.from(got), Buffer.from(tok))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await req.json();
  const done: string[] = [];
  for (const k of ["bundle", "traces", "spend"] as const) if (body[k]) { await kvSet(k, body[k]); done.push(k); }
  return NextResponse.json({ ok: true, stored: done });
}
