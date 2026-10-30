import Link from "next/link";
import { NextMilestoneCard } from "@/components/Milestone";
import { currentUser } from "@/lib/auth";
import { paymentsMode, SITE_NAME } from "@/lib/config";
import { getFunding, getLeaderboard } from "@/lib/funding";
import { PageHead } from "@/components/Brand";
import Leaderboard from "@/components/Leaderboard";

export const dynamic = "force-dynamic";
export const metadata = { title: "Donate" };

const ERR: Record<string, string> = { amount: "Please choose an amount between $1 and $10,000.", name: "Add a display name, or choose to donate anonymously.", unavailable: "Donations open as soon as card payments are connected. Please check back soon." };

export default async function Donate({ searchParams }: { searchParams: Promise<{ error?: string; cancelled?: string }> }) {
  const [f, user, sp, leaders] = await Promise.all([getFunding(), currentUser(), searchParams, getLeaderboard(8)]);
  return (
    <main>
      <PageHead eyebrow="Support the work" grey="Fund the" title={<>next <span className="text-vermilion">model.</span></>}>{SITE_NAME} is free and open. Your donation pays for API calls, nothing else is taken out except the card fee, and every dollar and expense is public. Donors can read the prompts and reasoning traces behind every public result.</PageHead>
      <section className="mx-auto grid max-w-[1200px] border-b border-rule md:grid-cols-[1.3fr_1fr] md:divide-x md:divide-rule">
      <div className="min-w-0 border-b border-rule p-5 md:border-b-0 md:p-8">
        {sp.error && <div className="mb-4 border border-vermilion bg-highlight/40 p-3 text-sm text-vermilion-dark">{ERR[sp.error] || "Something went wrong."}</div>}
        {sp.cancelled && <div className="mb-4 border border-rule bg-panel p-3 text-sm">Checkout cancelled. Nothing was charged.</div>}
        <form action="/api/donate" method="post" className="ticks space-y-7 border border-rule p-5 md:p-7">
          <div>
            <span className="label">Amount (USD)</span>
            <div className="grid grid-cols-4 gap-2">
              {[5, 10, 25, 100].map((a, i) => (
                <label key={a} className="cursor-pointer">
                  <input type="radio" name="amount" value={a} defaultChecked={i === 1} className="peer sr-only" />
                  <div className="num border border-rule bg-paper py-4 text-center text-[20px] font-medium hover:border-ink peer-checked:border-vermilion peer-checked:bg-vermilion peer-checked:text-white peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-ink">${a}</div>
                </label>
              ))}
            </div>
            <div className="mt-2 flex items-center gap-2 text-sm">
              <label className="flex items-center gap-2"><input type="radio" name="amount" value="" className="accent-ink" /> Other:</label>
              <input name="amount_custom" inputMode="decimal" placeholder="e.g. 42" className="input !w-32" />
            </div>
          </div>
          <fieldset>
            <span className="label">How should we show it?</span>
            <div className="grid gap-2 md:grid-cols-2">
              <label className="flex cursor-pointer gap-3 border border-rule p-3 has-[:checked]:border-ink has-[:checked]:bg-panel">
                <input type="radio" name="display_mode" value="anonymous" defaultChecked className="mt-1 accent-ink" />
                <span><b className="text-sm">Anonymous</b><span className="block text-xs text-ink/55">Counted in the total, shown as &ldquo;Anonymous&rdquo;.</span></span>
              </label>
              <label className="flex cursor-pointer gap-3 border border-rule p-3 has-[:checked]:border-ink has-[:checked]:bg-panel">
                <input type="radio" name="display_mode" value="named" className="mt-1 accent-ink" />
                <span><b className="text-sm">With my name</b><span className="block text-xs text-ink/55">On the public leaderboard.</span></span>
              </label>
            </div>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <div><span className="label">Display name</span><input name="display_name" maxLength={60} defaultValue={user?.display_name || ""} placeholder="e.g. Ada L." className="input" /></div>
              <div><span className="label">Message (optional)</span><input name="message" maxLength={140} placeholder="Shown with your donation" className="input" /></div>
            </div>
            {user ? (
              <label className="mt-3 flex items-center gap-2 text-sm"><input type="checkbox" name="link_to_account" defaultChecked className="accent-ink" />Link my name on the leaderboard to my account&apos;s profile link{user.link_url ? ` (${user.link_url})` : ""}. <Link href="/account" className="link">Edit</Link></label>
            ) : (
              <p className="mt-3 text-xs text-ink/55">Want your name linked to an account? <Link href="/signin?next=/donate" className="link">Sign in first</Link> (magic link, no password).</p>
            )}
          </fieldset>
          <div>
            <span className="label">Email for your receipt and donor access</span>
            <input name="email" type="email" defaultValue={user?.email || ""} placeholder="you@example.com" className="input" />
            <p className="mt-1 text-xs text-ink/50">Never shown publicly. Sign in later with this email to read prompts and reasoning traces.</p>
          </div>
          <button className="btn-money w-full !py-4 !text-base"><span className="h-2 w-2 bg-white" />{paymentsMode() === "mock" ? "Continue to test checkout" : "Continue to secure checkout"}</button>
          <p className="text-center text-xs text-ink/45">{paymentsMode() === "mock" ? "Mock mode: no card will be charged." : "Payments by Stripe. Card fee (about 2.9% + 30¢) is shown publicly."} Donations are not tax-deductible.</p>
        </form>
      </div>
      <aside className="flex min-w-0 flex-col">
        <NextMilestoneCard f={f} showQueue={4} cta={false} />
        <div className="border-b border-rule p-5 md:p-8">
          <div className="kicker border-b border-ink pb-3 text-ink">Our promises</div>
          <ol className="text-[15px] leading-snug">
            {["Donations never influence methods or results.", "Gifts from AI labs or their staff are disclosed.", "Each funded run has a hard spending cap equal to the money raised for it.", "Unused money stays in the pool for the next model."].map((t, i) => (
              <li key={i} className="flex gap-3 border-b border-rule py-3 last:border-0"><span className="num text-[11px] text-vermilion">{String(i + 1).padStart(2, "0")}</span>{t}</li>
            ))}
          </ol>
        </div>
        <div className="p-5 md:p-8"><Leaderboard rows={leaders} /></div>
      </aside>
      </section>
    </main>
  );
}
