import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { nowIso, q } from "@/lib/db";
import { markDonationPaid } from "@/lib/funding";
import { stripe } from "@/lib/stripe";

export async function POST(req: Request) {
  const sig = req.headers.get("stripe-signature");
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!sig || !secret) return NextResponse.json({ error: "not configured" }, { status: 400 });
  let event: Stripe.Event;
  try {
    event = stripe().webhooks.constructEvent(await req.text(), sig, secret);
  } catch {
    return NextResponse.json({ error: "bad signature" }, { status: 400 });
  }
  const seen = await q("SELECT 1 FROM events WHERE id=?", [event.id]);
  if (seen.length) return NextResponse.json({ ok: true, duplicate: true });

  if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
    const s = event.data.object as Stripe.Checkout.Session;
    const donationId = s.metadata?.donation_id;
    if (donationId && s.payment_status === "paid") {
      let fee: number | undefined;
      try {
        // Actual Stripe fee from the balance transaction (falls back to an estimate if not yet available).
        const pi = await stripe().paymentIntents.retrieve(String(s.payment_intent), { expand: ["latest_charge.balance_transaction"] });
        const bt = (pi.latest_charge as Stripe.Charge | null)?.balance_transaction as Stripe.BalanceTransaction | null;
        if (bt && typeof bt === "object") fee = bt.fee;
      } catch {}
      await markDonationPaid(donationId, { amount_cents: s.amount_total || 0, fee_cents: fee, fee_is_estimate: fee == null, email: s.customer_details?.email, payment_id: String(s.payment_intent || "") });
    }
  } else if (event.type === "charge.refunded") {
    const ch = event.data.object as Stripe.Charge;
    const id = ch.metadata?.donation_id;
    if (id) await q("UPDATE donations SET status='refunded' WHERE id=?", [id]); // funded milestones are not un-funded automatically
  }
  await q("INSERT INTO events (id, created_at) VALUES (?,?)", [event.id, nowIso()]);
  return NextResponse.json({ ok: true });
}
