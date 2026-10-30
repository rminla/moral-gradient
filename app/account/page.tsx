import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser, isAdmin, isDonor } from "@/lib/auth";
import { q } from "@/lib/db";
import { usd } from "@/lib/funding";

export const dynamic = "force-dynamic";
export const metadata = { title: "Your account" };

export default async function Account({ searchParams }: { searchParams: Promise<{ saved?: string }> }) {
  const u = await currentUser();
  if (!u) redirect("/signin");
  const [donor, gifts, sp] = await Promise.all([isDonor(u), q<any>("SELECT amount_cents, paid_at, display_mode FROM donations WHERE status='paid' AND (user_id=? OR email=?) ORDER BY paid_at DESC", [u.id, u.email]), searchParams]);
  return (
    <main className="mx-auto max-w-3xl px-5 py-12">
      <h1 className="serif text-[44px] leading-[1.05] tracking-[-0.02em]">Your account</h1>
      <p className="mt-1 text-ink/60">{u.email}</p>
      <div className={`card mt-6 p-5 ${donor ? "bg-moss/5 border-moss/40" : ""}`}>
        {donor ? <><div className="font-semibold text-moss">Donor access is on.</div><p className="mt-1 text-sm text-moss">Open any scenario on the <Link className="link" href="/results">results page</Link> to read its prompts and reasoning traces.</p></>
          : <><div className="font-semibold">No donations linked to this email yet.</div><p className="mt-1 text-sm text-ink/60">Donate any amount with this email to unlock prompts and reasoning traces. <Link href="/donate" className="link">Donate</Link></p></>}
      </div>
      <form action="/api/account" method="post" className="card mt-4 space-y-4 p-6">
        <div className="font-semibold">Public profile (leaderboard)</div>
        {sp.saved && <div className="text-sm text-moss">Saved.</div>}
        <div><span className="label">Display name</span><input name="display_name" defaultValue={u.display_name || ""} maxLength={60} className="input" /></div>
        <div><span className="label">Profile link (https)</span><input name="link_url" defaultValue={u.link_url || ""} placeholder="https://x.com/yourhandle" className="input" /><p className="mt-1 text-xs text-ink/50">Named donations you chose to link to your account show this link on the leaderboard.</p></div>
        <button className="btn-primary">Save</button>
      </form>
      {gifts.length > 0 && (
        <div className="card mt-4 p-5"><div className="label">Your donations</div>
          <ul className="mt-2 divide-y divide-ink/5 text-sm">{gifts.map((g, i) => <li key={i} className="flex justify-between py-2"><span>{new Date(g.paid_at).toLocaleDateString("en-US", { timeZone: "America/Los_Angeles" })} · {g.display_mode}</span><span className="num">{usd(g.amount_cents)}</span></li>)}</ul>
        </div>
      )}
      <div className="mt-6 flex items-center gap-4">
        <form action="/api/auth/signout" method="post"><button className="btn-ghost">Sign out</button></form>
        {isAdmin(u) && <Link href="/costs" className="text-sm underline">Admin: runs & queue</Link>}
      </div>
    </main>
  );
}
