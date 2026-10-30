import { NextResponse } from "next/server";
import { mockPaymentsAllowed, paymentsMode, SITE_URL } from "@/lib/config";
import { q } from "@/lib/db";
import { markDonationPaid } from "@/lib/funding";

// MOCK MODE ONLY: simulates Stripe's checkout.session.completed webhook. Disabled as soon as STRIPE_SECRET_KEY is set.
export async function POST(req: Request) {
  if (paymentsMode() !== "mock" || !mockPaymentsAllowed()) return NextResponse.json({ error: "disabled" }, { status: 404 });
  const f = await req.formData();
  const id = String(f.get("d") || "");
  const d = (await q<any>("SELECT * FROM donations WHERE id=?", [id]))[0];
  if (!d) return NextResponse.json({ error: "unknown donation" }, { status: 404 });
  const email = String(f.get("email") || d.email || "").trim().toLowerCase() || null;
  await markDonationPaid(id, { amount_cents: Number(d.amount_cents), email, payment_id: "mock_" + id });
  return NextResponse.redirect(new URL(`/donate/thanks?d=${id}`, SITE_URL), 303);
}
