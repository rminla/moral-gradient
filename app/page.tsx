import Link from "next/link";
import { ExampleBanner } from "@/components/Banner";
import { Figure } from "@/components/Bars";
import { GradientRule, Kicker, SectionHead } from "@/components/Brand";
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
  { n: "I", k: "saydo", q: "Does it act on the values it states?", d: "We ask each model what it believes, how it would judge someone else in a situation, and then put it in that situation as a tool-using agent. We compare the three." },
  { n: "II", k: "pressure", q: "Does it cave to pushback, flattery or authority?", d: "We push back on its answers with arguments, flattery, claimed authority and identity cues, and compare that with how it responds to real new information." },
  { n: "III", k: "selfinterest", q: "Does it bend when it benefits?", d: "Same everyday scenarios, plus a stake for the model itself: its ratings, its replacement, more autonomy, and whether anyone is watching." },
];

export default async function Home() {
  const [b, f, spend, leaders] = await Promise.all([getBundle(), getFunding(), getSpend(), getLeaderboard(5)]);
  const lead = b.findings.find((x) => x.pillar === "saydo") || b.findings[0];
  const updated = new Date(b.generated_utc).toLocaleDateString("en-US", { timeZone: "America/Los_Angeles", month: "long", day: "numeric", year: "numeric" });
  return (
    <main>
      <ExampleBanner example={b.is_example} exploratory={b.exploratory} examplesInLedger={f.has_examples} />

      {/* Masthead line */}
      <div className="mx-auto max-w-6xl px-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-ink/20 py-2.5 font-sans text-[11px] uppercase tracking-[0.12em] text-ink/55">
          <span>An open research tracker</span>
          <span className="hidden md:inline">{b.models.length} model{b.models.length === 1 ? "" : "s"} tested · {b.exploratory ? "pilot wave" : "wave 1"}</span>
          <span>Updated {updated}</span>
        </div>
      </div>

      {/* Hero */}
      <section className="mx-auto grid max-w-6xl gap-12 px-5 pb-14 pt-12 md:grid-cols-[1.15fr_1fr] md:pt-16">
        <div>
          <h1 className="serif text-[46px] leading-[1.02] tracking-[-0.02em] md:text-[72px]">
            Do AI models do what they <em className="text-vermilion">say</em> is right?
          </h1>
          <p className="mt-7 max-w-xl font-serif text-[20px] leading-[1.55] text-ink/85">
            {SITE_NAME} tracks how frontier and open-source AI models answer moral questions, then tests whether they <i>act</i> on those answers, whether they <i>hold</i> them under social pressure, and whether they <i>bend</i> them when they have something to gain.
          </p>
          <p className="mt-4 max-w-xl font-sans text-sm leading-6 text-ink/60">We never claim to know the right answer. We publish what each model chose, how consistent it was with itself, and what people say they would do where published human data exists.</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/results" className="btn-primary">Read the results</Link>
            <Link href="/about" className="btn-ghost">How it works</Link>
          </div>
        </div>

        {lead && (
          <figure className="self-end border-t-2 border-ink pt-3">
            <div className="flex items-baseline justify-between gap-3">
              <span className="kicker text-ink/60">Figure 1</span>
              <Kicker k={lead.pillar} />
            </div>
            <figcaption className="serif mt-2 text-[26px] leading-tight">{lead.headline}</figcaption>
            <p className="mt-1 font-sans text-xs text-ink/55">{modelName(b, lead.model)} · share of answers that followed its own stated view · {lead.stat_label}</p>
            <div className="mt-4"><Figure rows={lead.bars} /></div>
            <p className="mt-2 font-serif text-[15px] italic leading-snug text-ink/70">{lead.summary}</p>
            <Link href={`/f/${lead.id}`} className="mt-3 inline-block font-sans text-xs font-medium text-vermilion hover:underline">Read the finding and share it →</Link>
          </figure>
        )}
      </section>

      <div className="mx-auto max-w-6xl px-5"><GradientRule left="what it says" right="what it does" /></div>

      {/* Budget + milestone */}
      <section className="mx-auto grid max-w-6xl gap-6 px-5 pt-12 md:grid-cols-[1.3fr_1fr]">
        <div>
          <div className="kicker text-ink/60">Funded in public</div>
          <h2 className="serif mt-1 text-[32px] leading-tight">Every dollar in, every model call out.</h2>
          <p className="mt-2 max-w-xl font-serif text-[17px] leading-relaxed text-ink/75">Readers fund the runs. Each funded suite launches automatically with a hard spending cap, and every API call is priced on the <Link className="link" href="/costs">costs page</Link> within a minute.</p>
          <div className="mt-6"><LiveBudget initial={{ raised_usd: f.raised_cents / 100, pool_usd: f.pool_cents / 100, spent_usd: spend?.total_usd ?? null, spend_source: spend?.source ?? null, spend_as_of: spend?.as_of ?? null, donors: f.donors }} /></div>
        </div>
        <NextMilestoneCard f={f} showQueue={2} />
      </section>

      {/* Pillars */}
      <section className="mx-auto max-w-6xl px-5 pt-20">
        <SectionHead kicker="The method" title="Three questions, asked of every model">
          Underneath sits a baseline layer of validated questionnaires (MFQ-2, MFQ-30, Oxford Utilitarianism Scale, the trolley dilemmas) with published human answers for comparison.
        </SectionHead>
        <div className="mt-8 grid md:grid-cols-3 md:divide-x md:divide-ink/15">
          {PILLARS.map((p, i) => (
            <div key={p.k} className={`py-4 md:py-0 ${i === 0 ? "md:pr-6" : i === 1 ? "md:px-6" : "md:pl-6"} ${i > 0 ? "border-t border-ink/15 md:border-t-0" : ""}`}>
              <div className="flex items-baseline gap-2"><span className="serif text-[28px] italic text-ink/30">{p.n}.</span><Kicker k={p.k} /></div>
              <div className="serif mt-2 text-[24px] leading-[1.2]">{p.q}</div>
              <p className="mt-3 font-sans text-sm leading-6 text-ink/70">{p.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Findings */}
      <section className="mx-auto max-w-6xl px-5 pt-20">
        <SectionHead kicker="Latest findings" title={<span className="flex items-baseline justify-between gap-4">What the pilot found <Link href="/results" className="shrink-0 font-sans text-sm font-normal text-ink/60 hover:text-vermilion">All results →</Link></span>}>
          Every finding has a share graphic and one-click posting to X or LinkedIn.
        </SectionHead>
        <div className="mt-8 grid gap-x-8 gap-y-12 md:grid-cols-3">
          {b.findings.map((x) => <FindingCard key={x.id} f={x} modelName={modelName(b, x.model)} example={b.is_example} />)}
        </div>
      </section>

      {/* Contributors + donor access */}
      <section className="mx-auto mt-20 grid max-w-6xl gap-10 px-5 md:grid-cols-[1.3fr_1fr]">
        <Leaderboard rows={leaders} title="Top contributors" />
        <div className="flex flex-col justify-between bg-ink p-7 text-paper">
          <div>
            <div className="kicker text-vermilion-2">For donors</div>
            <div className="serif mt-2 text-[28px] leading-tight">See the reasoning, not just the score.</div>
            <p className="mt-3 font-sans text-sm leading-6 text-paper/70">Anyone who donates, any amount, can sign in to read the exact prompts and the models&apos; reasoning traces behind every public result. (Hold-out items stay private for everyone, so future models can&apos;t be trained on them.)</p>
          </div>
          <div className="mt-6 flex gap-3"><Link href="/donate" className="btn-money">Donate</Link><Link href="/signin" className="btn border-paper/30 text-paper hover:border-paper">Sign in</Link></div>
        </div>
      </section>
    </main>
  );
}
