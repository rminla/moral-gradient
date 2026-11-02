import { NextResponse } from "next/server";
import { SITE_URL } from "@/lib/config";
import { confirm } from "@/lib/subscribers";

/** POST only: a GET from a mail scanner must not confirm anyone. The /subscribe/confirm page holds the button. */
export async function POST(req: Request) {
  const f = await req.formData();
  const ok = await confirm(String(f.get("token") || ""));
  return NextResponse.redirect(new URL(`/subscribe?s=${ok ? "confirmed" : "expired"}`, SITE_URL), 303);
}
