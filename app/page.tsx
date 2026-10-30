import Link from "next/link";
import { ExampleBanner } from "@/components/Banner";
import { WhyItMatters } from "@/components/Alignment";
import { Kicker, SectionHead } from "@/components/Brand";
import FindingCard from "@/components/FindingCard";
import LiveBudget from "@/components/LiveBudget";
import { NextMilestoneCard } from "@/components/Milestone";
import Leaderboard from "@/components/Leaderboard";
import { getBundle, modelName, scenarioTitle } from "@/lib/bundle";
import { SITE_NAME } from "@/lib/config";
import { getFunding, getLeaderboard } from "@/lib/funding";
import { getSpend } from "@/lib/ledger";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [b, f, spend, leaders] = await Promise.all([getBundle(), getFunding(), getSpend(), getLeaderboard(5)]);
  const lead = b.findings.find((x) => x.pillar === "saydo") || b.findings[0];
  const updated = new Date(b.generated_utc).toLocaleDateString("en-US", { timeZone: "America/Los_Angeles", month: "long", day: "numeric", year: "numeric" });
  return (
    <main>
      <ExampleBanner example={b.is_example} exploratory={b.exploratory} examplesInLedger={f.has_examples} />

      {/* Masthead line */}
      <div className="mx-auto max-w-6xl px-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-ink/15 py-2.5 font-sans text-[11px] uppercase tracking-[0.12em] text-ink/55">
          <span>Tracking what AI models <b className="font-semibold text-vermilion">do</b>, not just what they say</span>
          <span className="hidden md:inline">{b.models.length} model{b.models.length === 1 ? "" : "s"} tested · {b.exploratory ? "pilot wave" : "wave 1"}</span>
          <span>Updated {updated}</span>
        </div>
      </div>

      {/* Hero: the finding itself, as the exhibit */}
      {lead && (() => {
        const sd = b.saydo.find((x) => x.model === lead.model && x.scenario === lead.scenario);
        const scen = b.scenarios.find((x) => x.id === lead.scenario);
        const n = sd?.do[0]?.n ?? sd?.judge.n ?? 20;
        const rows = lead.bars.slice(0, 3);
        return (
          <section className="mx-auto max-w-6xl px-5 pb-12 pt-8 md:pt-10">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="kicker text-ink/55">Exhibit 01 · {modelName(b, lead.model)} · {n} runs per row</span>
              <Kicker k={lead.pillar} />
            </div>
            <div className="mt-3 grid gap-8 border-t-2 border-ink pt-6 md:grid-cols-[17rem_minmax(0,1fr)] md:gap-12">
              <div>
                <div className="label">The situation</div>
                <div className="serif text-[24px] leading-tight">{scen?.title ?? scenarioTitle(b, lead.scenario || "")}</div>
                {scen?.judge_vignette && <p className="mt-2 font-sans text-[13px] leading-[1.6] text-ink/70">{scen.judge_vignette}</p>}
                {scen?.judge_options && sd && <p className="mt-3 font-sans text-[13px] text-ink/70">The choice: <b className="font-medium text-ink">{scen.judge_options[sd.say_implied_option]}</b></p>}
              </div>
              <div>
                <div className="space-y-6 md:space-y-7">
                  {rows.map((r, i) => {
                    const v = Math.min(1, Math.max(0, r.value ?? 0));
                    const isDo = i === rows.length - 1;
                    return (
                      <div key={r.label}>
                        <div className={`font-sans ${isDo ? "text-[17px] font-semibold text-vermilion md:text-[19px]" : "text-[15px] text-ink/80 md:text-[17px]"}`}>{r.label}</div>
                        <div className="mt-1 flex items-end gap-3 md:gap-4">
                          <div className={`relative min-w-0 flex-1 ${isDo ? "h-10 md:h-14" : "h-6 md:h-8"} bg-panel`}>
                            {[0.25, 0.5, 0.75].map((t) => <span key={t} className="absolute inset-y-0 w-px bg-ink/10" style={{ left: `${t * 100}%` }} />)}
                            <div className={`absolute inset-y-0 left-0 ${isDo ? "bg-vermilion" : i === 0 ? "bg-prussian" : "bg-prussian-2"}`} style={{ width: `${Math.max(v, 0.006) * 100}%` }} />
                            {isDo && v < 0.15 && <span className="absolute inset-y-0 left-3 flex items-center font-sans text-[13px] font-medium text-vermilion md:text-[15px]">never</span>}
                          </div>
                          <div className={`num shrink-0 text-right leading-[0.8] ${isDo ? "w-[8.5rem] text-[56px] font-medium text-vermilion md:w-[13rem] md:text-[104px]" : "w-[8.5rem] text-[34px] text-ink/75 md:w-[13rem] md:text-[52px]"}`}>
                            {Math.round(v * n)}<span className="text-[0.42em] text-ink/40">/{n}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <p className="mt-3 font-sans text-[12px] text-ink/60">{lead.axis ?? `% of ${n} runs`} · same situation each time, only the framing changes</p>
              </div>
            </div>
            <div className="mt-8 grid gap-6 border-t border-ink/15 pt-6 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
              <p className="serif max-w-3xl text-[26px] leading-[1.2] tracking-[-0.01em] md:text-[34px]">{lead.takeaway ?? lead.summary}</p>
              <div className="flex flex-wrap gap-x-6 gap-y-2 font-sans text-sm font-medium">
                <Link href={`/f/${lead.id}`} className="text-vermilion hover:underline">The full finding →</Link>
                <Link href="/results" className="text-ink/70 hover:text-ink">All results →</Link>
              </div>
            </div>
          </section>
        );
      })()}

      {/* Brand statement: emphasis on do */}
      <section className="border-y border-ink/15 bg-panel">
        <div className="mx-auto grid max-w-6xl items-center gap-6 px-5 py-10 md:grid-cols-[auto_minmax(0,1fr)] md:gap-12">
          <div className="serif select-none text-[120px] italic leading-[0.8] tracking-[-0.04em] text-vermilion md:text-[176px]">do.</div>
          <p className="max-w-2xl font-serif text-[21px] leading-[1.5] text-ink/85 md:text-[24px]">
            {SITE_NAME} is an open research tracker. It records what frontier and open-source AI models <b className="font-medium text-ink">do</b>, as agents with tools, under social pressure, and when they have something to gain, next to what they <span className="text-prussian">say</span> is right.
          </p>
        </div>
      </section>

      {/* Why this matters + the alignment ladder */}
      <section className="mx-auto max-w-6xl px-5 pt-16"><WhyItMatters /></section>

      {/* Budget + milestone */}
      <section className="mx-auto grid max-w-6xl gap-6 px-5 pt-20 md:grid-cols-[1.3fr_1fr]">
        <div>
          <div className="kicker text-ink/60">Funded in public</div>
          <h2 className="serif mt-1 text-[32px] leading-tight">Every dollar in, every model call out.</h2>
          <p className="mt-2 max-w-xl font-serif text-[17px] leading-relaxed text-ink/75">Readers fund the runs. Each funded suite launches automatically with a hard spending cap, and every API call is priced on the <Link className="link" href="/costs">costs page</Link> within a minute.</p>
          <div className="mt-6"><LiveBudget initial={{ raised_usd: f.raised_cents / 100, pool_usd: f.pool_cents / 100, spent_usd: spend?.total_usd ?? null, spend_source: spend?.source ?? null, spend_as_of: spend?.as_of ?? null, donors: f.donors }} /></div>
        </div>
        <NextMilestoneCard f={f} showQueue={2} />
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
