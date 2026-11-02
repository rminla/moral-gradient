import { NextResponse } from "next/server";
import { SITE_URL } from "@/lib/config";
import { allowRequest } from "@/lib/ratelimit";
import { EMAIL_RE, subscribe } from "@/lib/subscribers";

const SOURCES = new Set(["learn", "try", "results", "donate-thanks", "donate", "subscribe", "home"]);

function reply(req: Request, body: { ok: boolean; status: string; devLink?: string }, code = 200) {
  if ((req.headers.get("accept") || "").includes("application/json")) return NextResponse.json(body, { status: code, headers: { "cache-control": "no-store" } });
  const u = new URL("/subscribe", SITE_URL);
  u.searchParams.set("s", body.status);
  return NextResponse.redirect(u, 303);
}

export async function POST(req: Request) {
  const f = await req.formData();
  // Honeypot: real people never see or fill this field. Pretend success so bots learn nothing.
  if (String(f.get("website") || "")) return reply(req, { ok: true, status: "sent" });
  const email = String(f.get("email") || "").trim().toLowerCase();
  if (!EMAIL_RE.test(email) || email.length > 200) return reply(req, { ok: false, status: "invalid" }, 400);
  if (f.get("consent") !== "on") return reply(req, { ok: false, status: "consent" }, 400);
  const source = String(f.get("source") || "");
  if (!(await allowRequest(req, "sub", email, [20, 3600], [3, 86400]))) return reply(req, { ok: false, status: "limited" }, 429);
  const r = await subscribe(email, SOURCES.has(source) ? source : "other");
  return reply(req, { ok: true, status: r.status, devLink: r.devLink });
}
