import { NextResponse } from "next/server";
import { createMagicToken } from "@/lib/auth";
import { SITE_URL } from "@/lib/config";
import { sendMagicLink } from "@/lib/email";
import { allowRequest } from "@/lib/ratelimit";

export async function POST(req: Request) {
  const f = await req.formData();
  const email = String(f.get("email") || "").trim().toLowerCase();
  const next = String(f.get("next") || "/account");
  // Honeypot: bots that fill the hidden field get the normal "check your email" screen and nothing is sent.
  if (String(f.get("website") || "")) return NextResponse.redirect(new URL("/signin?sent=1", SITE_URL), 303);
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || email.length > 200) return NextResponse.redirect(new URL("/signin?error=email", SITE_URL), 303);
  // 10 requests per IP per 15 minutes, 5 links per address per hour.
  if (!(await allowRequest(req, "auth", email, [10, 900], [5, 3600]))) return NextResponse.redirect(new URL("/signin?error=limited", SITE_URL), 303);
  const token = await createMagicToken(email, next);
  const link = `${SITE_URL}/api/auth/verify?token=${token}`;
  try {
    const r = await sendMagicLink(email, link);
    if (r.devLink) return NextResponse.redirect(new URL(`/signin?sent=1&dev=${encodeURIComponent(r.devLink)}`, SITE_URL), 303);
  } catch {
    return NextResponse.redirect(new URL("/signin?error=send", SITE_URL), 303);
  }
  return NextResponse.redirect(new URL("/signin?sent=1", SITE_URL), 303);
}
