import Link from "next/link";
import { ProgressBar, MilestoneHeadline } from "@/components/Milestone";
import Share from "@/components/Share";
import { Mark } from "@/components/Brand";
import { currentUser } from "@/lib/auth";
import { SITE_NAME } from "@/lib/config";
import { q } from "@/lib/db";
import { getFunding, usd } from "@/lib/funding";

export const dynamic = "force-dynamic";

export default async function Thanks({ searchParams }: { searchParams: Promise<{ d?: string }> }) {
  const { d: id } = await searchParams;
  const d = (await q<any>("SELECT amount_cents, status, email FROM donations WHERE id=?", [id || ""]))[0];
  const [f, user] = await Promise.all([getFunding(), currentUser()]);
  return (
    <main>
      <section className="relative mx-auto max-w-[1200px] overflow-hidden border-b border-rule">
        <div aria-hidden className="pixel-grid absolute inset-0 [mask-image:linear-gradient(to_bottom,black,transparent_85%)]" />
        <div className="relative mx-auto max-w-2xl px-5 py-16 text-center md:py-24">
          <div className="flex justify-center"><Mark size={44} /></div>
          <h1 className="wide mt-6 text-[48px] font-bold leading-none tracking-[-0.045em] md:text-[72px]">Thank <span className="text-vermilion">you.</span></h1>
          {d && <p className="mt-4 text-[17px] text-ink/65">{d.status === "paid" ? `Your ${usd(d.amount_cents)} is in the pool.` : "Your payment is processing; the totals update as soon as Stripe confirms it."}</p>}
        </div>
      </section>
      <section className="mx-auto grid max-w-[1200px] border-b border-rule md:grid-cols-2 md:divide-x md:divide-rule">
        <div className="border-b border-rule p-5 md:border-b-0 md:p-8"><div className="kicker mb-4 text-ink/55">Next milestone</div><MilestoneHeadline f={f} /><div className="mt-4"><ProgressBar value={f.next ? f.next.progress : 1} tall /></div></div>
        <div className="p-5 text-[15px] md:p-8">
          <div className="kicker mb-4 text-ink/55">Your donor access</div>
          {user ? <p className="text-ink/70">You&apos;re signed in. Open any scenario to read its prompts and reasoning traces.</p>
            : <p className="text-ink/70">Sign in with {d?.email ? <b>{d.email}</b> : "the email you used"} to read prompts and reasoning traces. <Link className="link" href="/signin?next=/results">Sign in</Link></p>}
        </div>
      </section>
      <section className="mx-auto flex max-w-[1200px] flex-col items-center gap-4 border-b border-rule px-5 py-12">
        <div className="kicker text-ink/55">Tell people</div>
        <Share path="/donate" text={`I just helped fund ${SITE_NAME}, an open tracker of whether AI models act on the values they state.`} compact />
        <Link href="/costs" className="mt-2 font-mono text-[11px] uppercase tracking-[0.06em] text-ink/60 hover:text-vermilion">See where the money goes →</Link>
      </section>
    </main>
  );
}
