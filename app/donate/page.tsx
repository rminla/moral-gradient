import Link from "next/link";
import { NextMilestoneCard } from "@/components/Milestone";
import { currentUser } from "@/lib/auth";
import { paymentsMode, SITE_NAME } from "@/lib/config";
import { getFunding } from "@/lib/funding";

export const dynamic = "force-dynamic";
export const metadata = { title: "Donate" };

const ERR: Record<string, string> = { amount: "Please choose an amount between $1 and $10,000.", name: "Add a display name, or choose to donate anonymously.", unavailable: "Donations open as soon as card payments are connected. Please check back soon." };

export default async function Donate({ searchParams }: { searchParams: Promise<{ error?: string; cancelled?: string }> }) {
  const [f, user, sp] = await Promise.all([getFunding(), currentUser(), searchParams]);
  return (
    <main className="mx-auto grid max-w-6xl gap-8 px-5 py-12 md:grid-cols-[1.3fr_1fr]">
      <div>
        <h1 className="serif text-4xl">Fund the next model</h1>
        <p className="mt-2 max-w-xl text-black/60">{SITE_NAME} is free and open. Your donation pays for API calls, nothing else is taken out except the card fee, and every dollar and expense is public. Donors can read the prompts and reasoning traces behind every public result.</p>
        {sp.error && <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{ERR[sp.error] || "Something went wrong."}</div>}
        {sp.cancelled && <div className="mt-4 rounded-xl border border-black/10 bg-white p-3 text-sm">Checkout cancelled. Nothing was charged.</div>}
        <form action="/api/donate" method="post" className="card mt-6 space-y-6 p-6">
          <div>
            <span className="label">Amount (USD)</span>
            <div className="grid grid-cols-4 gap-2">
              {[5, 10, 25, 100].map((a, i) => (
                <label key={a} className="cursor-pointer">
                  <input type="radio" name="amount" value={a} defaultChecked={i === 1} className="peer sr-only" />
                  <div className="rounded-xl border border-black/15 bg-white py-3 text-center font-mono font-semibold peer-checked:border-ink peer-checked:bg-ink peer-checked:text-white">${a}</div>
                </label>
              ))}
            </div>
            <div className="mt-2 flex items-center gap-2 text-sm">
              <label className="flex items-center gap-2"><input type="radio" name="amount" value="" className="accent-black" /> Other:</label>
              <input name="amount_custom" inputMode="decimal" placeholder="e.g. 42" className="input !w-32" />
            </div>
          </div>
          <fieldset>
            <span className="label">How should we show it?</span>
            <div className="grid gap-2 md:grid-cols-2">
              <label className="flex cursor-pointer gap-3 rounded-xl border border-black/15 p-3 has-[:checked]:border-ink has-[:checked]:bg-black/[0.03]">
                <input type="radio" name="display_mode" value="anonymous" defaultChecked className="mt-1 accent-black" />
                <span><b className="text-sm">Anonymous</b><span className="block text-xs text-black/55">Counted in the total, shown as &ldquo;Anonymous&rdquo;.</span></span>
              </label>
              <label className="flex cursor-pointer gap-3 rounded-xl border border-black/15 p-3 has-[:checked]:border-ink has-[:checked]:bg-black/[0.03]">
                <input type="radio" name="display_mode" value="named" className="mt-1 accent-black" />
                <span><b className="text-sm">With my name</b><span className="block text-xs text-black/55">On the public leaderboard.</span></span>
              </label>
            </div>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <div><span className="label">Display name</span><input name="display_name" maxLength={60} defaultValue={user?.display_name || ""} placeholder="e.g. Ada L." className="input" /></div>
              <div><span className="label">Message (optional)</span><input name="message" maxLength={140} placeholder="Shown with your donation" className="input" /></div>
            </div>
            {user ? (
              <label className="mt-3 flex items-center gap-2 text-sm"><input type="checkbox" name="link_to_account" defaultChecked className="accent-black" />Link my name on the leaderboard to my account&apos;s profile link{user.link_url ? ` (${user.link_url})` : ""}. <Link href="/account" className="underline">Edit</Link></label>
            ) : (
              <p className="mt-3 text-xs text-black/55">Want your name linked to an account? <Link href="/signin?next=/donate" className="underline">Sign in first</Link> (magic link, no password).</p>
            )}
          </fieldset>
          <div>
            <span className="label">Email for your receipt and donor access</span>
            <input name="email" type="email" defaultValue={user?.email || ""} placeholder="you@example.com" className="input" />
            <p className="mt-1 text-xs text-black/50">Never shown publicly. Sign in later with this email to read prompts and reasoning traces.</p>
          </div>
          <button className="btn-money w-full !py-3 text-base">{paymentsMode() === "mock" ? "Continue to test checkout" : "Continue to secure checkout"}</button>
          <p className="text-center text-xs text-black/45">{paymentsMode() === "mock" ? "Mock mode: no card will be charged." : "Payments by Stripe. Card fee (about 2.9% + 30¢) is shown publicly."} Donations are not tax-deductible.</p>
        </form>
      </div>
      <aside className="space-y-4">
        <NextMilestoneCard f={f} showQueue={4} />
        <div className="card p-5 text-sm leading-6 text-black/65">
          <div className="label">Our promises</div>
          <ul className="list-disc space-y-1 pl-4">
            <li>Donations never influence methods or results.</li>
            <li>Gifts from AI labs or their staff are disclosed.</li>
            <li>Each funded run has a hard spending cap equal to the money raised for it.</li>
            <li>Unused money stays in the pool for the next model.</li>
          </ul>
        </div>
      </aside>
    </main>
  );
}
