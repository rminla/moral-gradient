import { NextResponse } from "next/server";
import { consumeMagicToken, startSession } from "@/lib/auth";
import { SITE_URL } from "@/lib/config";

export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get("token") || "";
  const r = await consumeMagicToken(token);
  if (!r) return NextResponse.redirect(new URL("/signin?error=expired", SITE_URL), 303);
  await startSession(r.userId);
  return NextResponse.redirect(new URL(r.next, SITE_URL), 303);
}
