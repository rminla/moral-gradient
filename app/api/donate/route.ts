import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { MAX_DONATION_CENTS, MIN_DONATION_CENTS, mockPaymentsAllowed, paymentsMode, SITE_NAME, SITE_URL } from "@/lib/config";
import { newId, nowIso, q } from "@/lib/db";
import { stripe } from "@/lib/stripe";
import { allowRequest } from "@/lib/ratelimit";
import { EMAIL_RE, subscribe } from "@/lib/subscribers";

const clean = (s: FormDataEntryValue | null, max: number) => String(s || "").replace(/[\u0000-\u001f]/g, " ").trim().slice(0, max);

export async function POST(req: Request) {
  if (paymentsMode() === "mock" && !mockPaymentsAllowed()) return NextResponse.redirect(new URL("/donate?error=unavailable", SITE_URL), 303);
  const f = await req.formData();
  const amount = Math.round(parseFloat(String(f.get("amount") || f.get("amount_custom") || "0")) * 100);
  if (!Number.isFinite(amount) || amount < MIN_DONATION_CENTS || amount > MAX_DONATION_CENTS)
    return NextResponse.redirect(new URL("/donate?error=amount", SITE_URL), 303);
  const user = await currentUser();
  const named = f.get("display_mode") === "named";
  const displayName = named ? clean(f.get("display_name"), 60) || user?.display_name || "" : "";
  if (named && !displayName) return NextResponse.redirect(new URL("/donate?error=name", SITE_URL), 303);
  const linkToAccount = named && !!user && f.get("link_to_account") === "on";
  const email = clean(f.get("email"), 200).toLowerCase() || user?.email || null;
  const id = newId("don_");
  await q(`INSERT INTO donations (id, created_at, amount_cents, display_mode, display_name, message, email, user_id, link_to_account, provider) VALUES (?,?,?,?,?,?,?,?,?,?)`, [
    id, nowIso(), amount, named ? "named" : "anonymous", displayName || null, clean(f.get("message"), 140) || null, email, user?.id || null, linkToAccount ? 1 : 0, paymentsMode(),
  ]);

  // Unticked by default. Double opt-in, so ticking it only sends a confirmation email. Never blocks the donation.
  if (f.get("subscribe") === "on" && email && EMAIL_RE.test(email)) {
    try { if (await allowRequest(req, "sub", email, [20, 3600], [3, 86400])) await subscribe(email, "donate"); } catch { /* ignore */ }
  }

  if (paymentsMode() === "mock") return NextResponse.redirect(new URL(`/donate/mock-checkout?d=${id}`, SITE_URL), 303);

  const session = await stripe().checkout.sessions.create({
    mode: "payment",
    submit_type: "donate",
    line_items: [{ quantity: 1, price_data: { currency: "usd", unit_amount: amount, product_data: { name: `Donation to ${SITE_NAME}`, description: "Funds model runs. Every dollar and every expense is shown publicly." } } }],
    customer_email: email || undefined,
    metadata: { donation_id: id },
    payment_intent_data: { metadata: { donation_id: id } },
    success_url: `${SITE_URL}/donate/thanks?d=${id}`,
    cancel_url: `${SITE_URL}/donate?cancelled=1`,
  });
  await q("UPDATE donations SET provider_session_id=? WHERE id=?", [session.id, id]);
  return NextResponse.redirect(session.url!, 303);
}
