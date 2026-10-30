import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { nowIso, q } from "@/lib/db";

/** Runner callback: { status: "running"|"published"|"failed", detail? }. Bearer INGEST_TOKEN. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const tok = process.env.INGEST_TOKEN || "";
  const got = (req.headers.get("authorization") || "").replace(/^Bearer /, "");
  if (!tok || got.length !== tok.length || !timingSafeEqual(Buffer.from(got), Buffer.from(tok))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const { status, detail } = await req.json();
  if (!["running", "published", "failed"].includes(status)) return NextResponse.json({ error: "bad status" }, { status: 400 });
  await q("UPDATE jobs SET status=?, detail=COALESCE(?,detail), finished_at=? WHERE id=?", [status, detail ? String(detail).slice(0, 500) : null, status === "running" ? null : nowIso(), id]);
  await q("UPDATE milestones SET status=? WHERE job_id=?", [status, id]);
  return NextResponse.json({ ok: true });
}
