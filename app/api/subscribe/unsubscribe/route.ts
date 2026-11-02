import { NextResponse } from "next/server";
import { SITE_URL } from "@/lib/config";
import { unsubscribe } from "@/lib/subscribers";

/** Handles the page button (form fields) and RFC 8058 one-click unsubscribe (id and sig in the query string). */
export async function POST(req: Request) {
  const url = new URL(req.url);
  const f = await req.formData().catch(() => null);
  const id = String(f?.get("id") || url.searchParams.get("id") || "");
  const sig = String(f?.get("sig") || url.searchParams.get("sig") || "");
  const ok = await unsubscribe(id, sig);
  if (f?.get("List-Unsubscribe") === "One-Click") return new NextResponse(ok ? "unsubscribed" : "invalid link", { status: ok ? 200 : 400 });
  return NextResponse.redirect(new URL(`/subscribe?s=${ok ? "unsubscribed" : "badlink"}`, SITE_URL), 303);
}
