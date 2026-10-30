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
    <main className="mx-auto max-w-[1200px] border-b border-rule px-5 py-16"><div className="mx-auto max-w-md">
      <div className="mb-4 border border-rule bg-panel p-3 font-mono text-[11px] leading-5 text-ink/70"><b>Mock checkout.</b> This stands in for Stripe Checkout until Stripe keys are configured. No card is charged; completing it simulates Stripe&apos;s payment webhook.</div>
      <form action="/api/donate/mock-complete" method="post" className="ticks space-y-5 border border-rule p-6">
        <input type="hidden" name="d" value={d.id} />
        <div className="kicker text-ink/55">Donation</div>
        <div className="num text-[48px] font-medium leading-none tracking-[-0.04em]">{usd(d.amount_cents)}</div>
        <div><span className="label">Email</span><input name="email" type="email" defaultValue={d.email || ""} className="input" placeholder="you@example.com" /></div>
        <div><span className="label">Card</span><input disabled value="4242 4242 4242 4242 · 12/34 · 123" className="input bg-panel text-ink/50" /></div>
        <button className="btn-primary w-full !py-3">Pay {usd(d.amount_cents)} (test)</button>
      </form>
    </div></main>
  );
}
