import Link from "next/link";
import { ExampleBanner } from "@/components/Banner";
import FindingCard from "@/components/FindingCard";
import LiveBudget from "@/components/LiveBudget";
import { NextMilestoneCard } from "@/components/Milestone";
import Leaderboard from "@/components/Leaderboard";
import { getBundle, modelName } from "@/lib/bundle";
import { SITE_NAME } from "@/lib/config";
import { getFunding, getLeaderboard } from "@/lib/funding";
import { getSpend } from "@/lib/ledger";

export const dynamic = "force-dynamic";

const PILLARS = [
  { k: "Say vs Do", c: "bg-say", q: "Does it act on the values it states?", d: "We ask each model what it believes, how it would judge someone else in a situation, and then put it in that situation as a tool-using agent. We compare the three." },
  { k: "Under pressure", c: "bg-judge", q: "Does it cave to pushback, flattery or authority?", d: "We push back on its answers with arguments, flattery, claimed authority and identity cues, and compare that with how it responds to real new information." },
  { k: "Self-interest", c: "bg-do", q: "Does it bend when it benefits?", d: "Same everyday scenarios, plus a stake for the model itself: its ratings, its replacement, more autonomy, and whether anyone is watching." },
];

export default async function Home() {
  const [b, f, spend, leaders] = await Promise.all([getBundle(), getFunding(), getSpend(), getLeaderboard(5)]);
  return (
    <main>
      <ExampleBanner example={b.is_example} exploratory={b.exploratory} examplesInLedger={f.has_examples} />
      <section className="relative overflow-hidden border-b border-black/10">
        <div className="pointer-events-none absolute -right-40 -top-40 h-[520px] w-[520px] rounded-full bg-gradient-to-br from-violet-200/60 via-sky-200/40 to-amber-200/50 blur-3xl" />
        <div className="relative mx-auto grid max-w-6xl gap-10 px-5 py-16 md:grid-cols-[1.25fr_1fr] md:py-20">
          <div>
            <div className="chip mb-5">Open data · open costs · funded by readers</div>
            <h1 className="serif text-5xl leading-[1.05] tracking-tight md:text-6xl">Do AI models do<br />what they <em>say</em> is right?</h1>
            <p className="mt-6 max-w-xl text-lg leading-8 text-black/70">
              {SITE_NAME} tracks how frontier and open-source AI models answer moral questions, and then tests whether they <b>act</b> on those answers, whether they <b>hold</b> them under social pressure, and whether they <b>bend</b> them when they have something to gain.
            </p>
            <p className="mt-3 max-w-xl text-sm leading-6 text-black/55">We never claim to know the right answer. We publish what each model chose, how consistent it was with itself, and what people say they would do where published human data exists.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/results" className="btn-primary">See the results</Link>
              <Link href="/about" className="btn-ghost">How it works</Link>
            </div>
          </div>
          <div className="space-y-4">
            <LiveBudget initial={{ raised_usd: f.raised_cents / 100, pool_usd: f.pool_cents / 100, spent_usd: spend?.total_usd ?? null, spend_source: spend?.source ?? null, spend_as_of: spend?.as_of ?? null, donors: f.donors }} />
            <NextMilestoneCard f={f} showQueue={2} />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-16">
        <h2 className="serif text-3xl">Three questions, every model</h2>
        <p className="mt-2 max-w-2xl text-black/60">Underneath sits a baseline layer of validated questionnaires (MFQ-2, MFQ-30, Oxford Utilitarianism Scale, the trolley dilemmas) with published human answers for comparison.</p>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {PILLARS.map((p) => (
            <div key={p.k} className="card p-5">
              <div className="flex items-center gap-2 text-sm font-semibold"><span className={`h-2.5 w-2.5 rounded-full ${p.c}`} />{p.k}</div>
              <div className="serif mt-3 text-xl leading-snug">{p.q}</div>
              <p className="mt-2 text-sm leading-6 text-black/65">{p.d}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5">
        <div className="flex items-end justify-between">
          <div>
            <h2 className="serif text-3xl">Latest findings</h2>
            <p className="mt-1 text-sm text-black/55">One click to share any finding on X or LinkedIn, with a generated graphic.</p>
          </div>
          <Link href="/results" className="text-sm font-semibold text-black/60 hover:text-black">All results →</Link>
        </div>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {b.findings.map((x) => <FindingCard key={x.id} f={x} modelName={modelName(b, x.model)} example={b.is_example} />)}
        </div>
      </section>

      <section className="mx-auto mt-16 grid max-w-6xl gap-4 px-5 md:grid-cols-[1.3fr_1fr]">
        <Leaderboard rows={leaders} title="Top contributors" />
        <div className="card flex flex-col justify-between bg-ink p-6 text-white">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-white/50">For donors</div>
            <div className="serif mt-2 text-2xl leading-snug">See the reasoning, not just the score.</div>
            <p className="mt-3 text-sm leading-6 text-white/70">Anyone who donates, any amount, can sign in to read the exact prompts and the models&apos; reasoning traces behind every public result. (Hold-out items stay private for everyone, so future models can&apos;t be trained on them.)</p>
          </div>
          <div className="mt-6 flex gap-3"><Link href="/donate" className="btn bg-white text-ink hover:bg-white/90">Donate</Link><Link href="/signin" className="btn border border-white/25 hover:bg-white/10">Sign in</Link></div>
        </div>
      </section>
    </main>
  );
}
