import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser, isAdmin, isDonor } from "@/lib/auth";
import { q } from "@/lib/db";
import { usd } from "@/lib/funding";
import { PageHead } from "@/components/Brand";

export const dynamic = "force-dynamic";
export const metadata = { title: "Your account" };

export default async function Account({ searchParams }: { searchParams: Promise<{ saved?: string }> }) {
  const u = await currentUser();
  if (!u) redirect("/signin");
  const [donor, gifts, sp] = await Promise.all([isDonor(u), q<any>("SELECT amount_cents, paid_at, display_mode FROM donations WHERE status='paid' AND (user_id=? OR email=?) ORDER BY paid_at DESC", [u.id, u.email]), searchParams]);
  return (
    <main>
      <PageHead eyebrow="Account" title="Your account."><span className="font-mono text-[14px]">{u.email}</span></PageHead>
      <section className="mx-auto grid max-w-[1200px] border-b border-rule md:grid-cols-[1fr_1.3fr] md:divide-x md:divide-rule">
      <div className="space-y-3 border-b border-rule p-5 md:border-b-0 md:p-8">
      <div className={`p-5 ${donor ? "bg-ink text-white" : "hatch border border-rule"}`}>
        {donor ? <><div className="kicker flex items-center gap-2 text-white/60"><span className="h-2 w-2 bg-vermilion" />Donor access</div><div className="mt-3 text-[18px] font-semibold">Donor access is on.</div><p className="mt-1 text-sm text-white/70">Open any scenario on the <Link className="link" href="/results">results page</Link> to read its prompts and reasoning traces.</p></>
          : <><div className="kicker text-ink/55">Donor access</div><div className="mt-3 text-[18px] font-semibold">No donations linked to this email yet.</div><p className="mt-1 text-sm text-ink/60">Donate any amount with this email to unlock prompts and reasoning traces. <Link href="/donate" className="link">Donate</Link></p></>}
      </div>
      {gifts.length > 0 && (
        <div className="border border-rule p-5"><div className="kicker border-b border-ink pb-3 text-ink">Your donations</div>
          <ul className="divide-y divide-rule text-sm">{gifts.map((g, i) => <li key={i} className="flex justify-between py-2.5"><span>{new Date(g.paid_at).toLocaleDateString("en-US", { timeZone: "America/Los_Angeles" })} · {g.display_mode}</span><span className="num">{usd(g.amount_cents)}</span></li>)}</ul>
        </div>
      )}
      <div className="flex items-center gap-4 pt-2">
        <form action="/api/auth/signout" method="post"><button className="btn-ghost">Sign out</button></form>
        {isAdmin(u) && <Link href="/costs" className="font-mono text-[11px] uppercase tracking-[0.06em] underline">Admin: runs & queue</Link>}
      </div>
      </div>
      <form action="/api/account" method="post" className="space-y-5 p-5 md:p-8">
        <div className="kicker border-b border-ink pb-3 text-ink">Public profile (leaderboard)</div>
        {sp.saved && <div className="flex items-center gap-2 font-mono text-[11px] uppercase text-moss"><span className="h-2 w-2 bg-moss" />Saved</div>}
        <div><span className="label">Display name</span><input name="display_name" defaultValue={u.display_name || ""} maxLength={60} className="input" /></div>
        <div><span className="label">Profile link (https)</span><input name="link_url" defaultValue={u.link_url || ""} placeholder="https://x.com/yourhandle" className="input" /><p className="mt-1 text-xs text-ink/50">Named donations you chose to link to your account show this link on the leaderboard.</p></div>
        <button className="btn-primary">Save</button>
      </form>
      </section>
    </main>
  );
}
