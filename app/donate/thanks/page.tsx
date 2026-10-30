import Link from "next/link";
import { ProgressBar, MilestoneHeadline } from "@/components/Milestone";
import Share from "@/components/Share";
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
    <main className="mx-auto max-w-2xl px-5 py-16 text-center">
      <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-emerald-100 text-2xl">✓</div>
      <h1 className="serif mt-4 text-4xl">Thank you.</h1>
      {d && <p className="mt-2 text-black/60">{d.status === "paid" ? `Your ${usd(d.amount_cents)} is in the pool.` : "Your payment is processing; the totals update as soon as Stripe confirms it."}</p>}
      <div className="card mt-8 p-5 text-left"><MilestoneHeadline f={f} /><div className="mt-3"><ProgressBar value={f.next ? f.next.progress : 1} tall /></div></div>
      <div className="card mt-4 p-5 text-left text-sm">
        <div className="font-semibold">Your donor access</div>
        {user ? <p className="mt-1 text-black/60">You&apos;re signed in. Open any scenario to read its prompts and reasoning traces.</p>
          : <p className="mt-1 text-black/60">Sign in with {d?.email ? <b>{d.email}</b> : "the email you used"} to read prompts and reasoning traces. <Link className="underline" href="/signin?next=/results">Sign in</Link></p>}
      </div>
      <div className="mt-8 flex flex-col items-center gap-2"><div className="label">Tell people</div><Share path="/donate" text={`I just helped fund ${SITE_NAME}, an open tracker of whether AI models act on the values they state.`} compact /></div>
      <Link href="/costs" className="mt-8 inline-block text-sm font-semibold text-black/60 hover:text-black">See where the money goes →</Link>
    </main>
  );
}
