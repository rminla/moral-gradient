import { notFound } from "next/navigation";
import { mockPaymentsAllowed, paymentsMode } from "@/lib/config";
import { q } from "@/lib/db";
import { usd } from "@/lib/funding";

export const dynamic = "force-dynamic";

export default async function MockCheckout({ searchParams }: { searchParams: Promise<{ d?: string }> }) {
  if (paymentsMode() !== "mock" || !mockPaymentsAllowed()) notFound();
  const { d: id } = await searchParams;
  const d = (await q<any>("SELECT * FROM donations WHERE id=?", [id || ""]))[0];
  if (!d) notFound();
  return (
    <main className="mx-auto max-w-md px-5 py-16">
      <div className="mb-4 border border-ink/20 bg-highlight/40 p-3 text-xs text-ink"><b>Mock checkout.</b> This stands in for Stripe Checkout until Stripe keys are configured. No card is charged; completing it simulates Stripe&apos;s payment webhook.</div>
      <form action="/api/donate/mock-complete" method="post" className="card space-y-4 p-6">
        <input type="hidden" name="d" value={d.id} />
        <div className="text-sm text-ink/55">Donation</div>
        <div className="num text-4xl font-semibold">{usd(d.amount_cents)}</div>
        <div><span className="label">Email</span><input name="email" type="email" defaultValue={d.email || ""} className="input" placeholder="you@example.com" /></div>
        <div><span className="label">Card</span><input disabled value="4242 4242 4242 4242 · 12/34 · 123" className="input bg-ink/[0.03] text-ink/50" /></div>
        <button className="btn-primary w-full !py-3">Pay {usd(d.amount_cents)} (test)</button>
      </form>
    </main>
  );
}
