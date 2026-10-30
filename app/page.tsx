import Link from "next/link";
import { ExampleBanner } from "@/components/Banner";
import { WhyItMatters } from "@/components/Alignment";
import { Eyebrow } from "@/components/Brand";
import FindingCard from "@/components/FindingCard";
import LiveBudget from "@/components/LiveBudget";
import Leaderboard from "@/components/Leaderboard";
import { NextMilestoneCard } from "@/components/Milestone";
import { HumanSlot } from "@/components/Human";
import { getBundle, modelName, scenarioTitle } from "@/lib/bundle";
import { getFunding, getLeaderboard } from "@/lib/funding";
import { getSpend } from "@/lib/ledger";

export const dynamic = "force-dynamic";

/* Direction A, "Signal": framed grid, black/white cells, one signal red for what models do. */

export default async function Home() {
  const [b, f, spend, leaders] = await Promise.all([getBundle(), getFunding(), getSpend(), getLeaderboard(5)]);
  const lead = b.findings.find((x) => x.pillar === "saydo") || b.findings[0];
  const updated = new Date(b.generated_utc).toLocaleDateString("en-US", { timeZone: "America/Los_Angeles", month: "short", day: "numeric", year: "numeric" });
  const sd = lead ? b.saydo.find((x) => x.model === lead.model && x.scenario === lead.scenario) : undefined;
  const scen = lead ? b.scenarios.find((x) => x.id === lead.scenario) : undefined;
  const n = sd?.do[0]?.n ?? sd?.judge.n ?? 20;
  const rows = lead ? lead.bars.slice(0, 3) : [];

  return (
    <main>
      <ExampleBanner example={b.is_example} exploratory={b.exploratory} examplesInLedger={f.has_examples} />

      {/* ── Hero ───────────────────────────────────────────── */}
      <section className="relative mx-auto max-w-[1200px] overflow-hidden border-b border-rule">
        <div aria-hidden className="pixel-grid absolute inset-0 [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_75%)]" />
        {/* scattered "run" pixels */}
        <div aria-hidden className="absolute inset-0 hidden md:block">
          {[[2, 3], [4, 1], [3, 9], [37, 2], [39, 6], [36, 11], [1, 13], [41, 14]].map(([x, y], i) => (
            <span key={i} className={`absolute h-[27px] w-[27px] ${i === 3 ? "bg-vermilion" : "bg-ink/[0.07]"}`} style={{ left: x * 28 + 1, top: y * 28 + 1 }} />
          ))}
        </div>
        <div className="relative px-5 pb-16 pt-16 text-center md:pb-20 md:pt-24">
          <div className="rise"><Eyebrow>Open research tracker · {b.models.length} model{b.models.length === 1 ? "" : "s"}<span className="hidden sm:inline"> · Updated {updated}</span></Eyebrow></div>
          <h1 className="rise wide mx-auto mt-7 max-w-[1000px] text-[44px] font-bold leading-[0.95] tracking-[-0.045em] [animation-delay:80ms] md:text-[84px]">
            <span className="text-ink/35">AI models say the right thing.</span>{" "}
            We track what they <span className="relative inline-block text-vermilion">do<span className="ml-[0.06em] inline-block h-[0.16em] w-[0.16em] bg-vermilion align-baseline" /></span>
          </h1>
          <p className="rise mx-auto mt-7 max-w-[620px] text-[17px] leading-relaxed text-ink/65 [animation-delay:160ms] md:text-[19px]">
            An open, reader-funded record of how AI models act as agents with tools, under social pressure, and when they have something to gain, next to what they say is right.
          </p>
          <div className="rise mt-9 flex flex-wrap justify-center gap-3 [animation-delay:240ms]">
            <Link href="/results" className="btn-primary"><span className="h-2 w-2 bg-vermilion" />See the results</Link>
            <Link href="/donate" className="btn-ghost">Fund the next model</Link>
          </div>
        </div>
      </section>

      {/* ── Exhibit: one row of cells per run ─────────────────── */}
      {lead && (
        <section className="mx-auto max-w-[1200px] border-b border-rule">
          <div className="grid border-b border-rule md:grid-cols-[minmax(0,1fr)_auto]">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-4 md:px-8">
              <span className="kicker text-ink">Exhibit 01</span>
              <span className="kicker text-ink/45">{modelName(b, lead.model)} · {scen?.title ?? scenarioTitle(b, lead.scenario || "")} · {n} runs per row</span>
            </div>
            <div className="hidden items-center gap-4 border-l border-rule px-8 font-mono text-[10.5px] uppercase tracking-[0.08em] text-ink/50 md:flex">
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 bg-ink" />sided with waiving</span>
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 border border-vermilion/50 bg-panel" />did not</span>
            </div>
          </div>
          <div className="grid md:grid-cols-[300px_minmax(0,1fr)]">
            <div className="border-b border-rule p-5 md:border-b-0 md:border-r md:p-8">
              <div className="label">The situation</div>
              {scen?.judge_vignette && <p className="text-[15px] leading-[1.6] text-ink/75">{scen.judge_vignette}</p>}
              {scen?.judge_options && sd && <p className="mt-4 text-[14px] text-ink/70">The choice: <b className="font-semibold text-ink">{scen.judge_options[sd.say_implied_option]}</b></p>}
            </div>
            <div className="flex flex-col divide-y divide-rule">
              {rows.map((r, i) => {
                const v = Math.min(1, Math.max(0, r.value ?? 0));
                const filled = Math.round(v * n);
                const isDo = i === rows.length - 1;
                return (
                  <div key={r.label} className={`grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-3 p-5 md:grid-cols-[200px_minmax(0,1fr)_150px] md:gap-6 md:px-8 ${isDo ? "flex-1 bg-vermilion/[0.04]" : ""}`}>
                    <div className={`text-[15px] leading-snug ${isDo ? "font-semibold text-vermilion" : "text-ink/75"}`}>{r.label}</div>
                    <div className="col-span-2 grid grid-cols-[repeat(20,minmax(0,1fr))] gap-[3px] md:order-2 md:col-span-1">
                      {Array.from({ length: n }, (_, j) => (
                        <span key={j} className={`cell-in aspect-square ${j < filled ? (isDo ? "bg-vermilion" : i === 0 ? "bg-ink" : "bg-prussian") : "border border-vermilion/45 bg-paper"}`} style={{ animationDelay: `${300 + i * 260 + j * 22}ms` }} />
                      ))}
                    </div>
                    <div className={`num text-right leading-none md:order-3 ${isDo ? "text-[52px] font-semibold text-vermilion md:text-[88px]" : "text-[30px] text-ink/70 md:text-[44px]"}`}>
                      {filled}<span className="text-[0.4em] text-ink/35">/{n}</span>
                    </div>
                  </div>
                );
              })}
              <HumanSlot className="px-5 py-3 md:px-8" />
            </div>
          </div>
          <div className="grid bg-ink text-white md:grid-cols-[minmax(0,1fr)_auto]">
            <p className="serif px-5 py-7 text-[24px] leading-[1.15] md:px-8 md:py-9 md:text-[34px]">{lead.takeaway ?? lead.summary}</p>
            <div className="flex border-t border-white/10 md:flex-col md:border-l md:border-t-0">
              <Link href={`/f/${lead.id}`} className="flex flex-1 items-center gap-2 whitespace-nowrap px-5 py-4 font-mono text-[12px] uppercase tracking-[0.08em] hover:bg-vermilion md:px-8"><span className="h-2 w-2 bg-vermilion" />The full finding →</Link>
              <Link href="/results" className="flex flex-1 items-center whitespace-nowrap border-l border-white/10 px-5 py-4 font-mono text-[12px] uppercase tracking-[0.08em] text-white/70 hover:text-white md:border-l-0 md:border-t md:px-8">All results →</Link>
            </div>
          </div>
          <p className="px-5 py-3 font-mono text-[10.5px] text-ink/50 md:px-8">{lead.axis ?? `% of ${n} runs`} · one square = one run · same situation each time, only the framing changes</p>
        </section>
      )}

      {/* ── Three questions strip ─────────────────────────────── */}
      <section className="mx-auto grid max-w-[1200px] border-b border-rule sm:grid-cols-3">
        {[
          ["01", "Say vs do", "Does it act on what it says?", "/results#saydo"],
          ["02", "Under pressure", "Does it cave when pushed?", "/results#pressure"],
          ["03", "Self-interest", "Does it bend when it benefits?", "/results#selfinterest"],
        ].map(([k, t, q, h], i) => (
          <Link key={k} href={h} className={`group p-5 hover:bg-panel md:p-8 ${i < 2 ? "border-b border-rule sm:border-b-0 sm:border-r" : ""}`}>
            <div className="flex justify-between font-mono text-[11px] uppercase tracking-[0.08em] text-ink/45"><span>{k}</span><span className="group-hover:text-vermilion">→</span></div>
            <div className="wide mt-8 text-[13px] font-bold uppercase text-vermilion">{t}</div>
            <div className="serif mt-1 text-[24px] leading-tight">{q}</div>
          </Link>
        ))}
      </section>

      {/* ── Why it matters: dark full-bleed ───────────────────── */}
      <section className="relative mt-20 bg-ink text-white">
        <div aria-hidden className="pixel-grid-dark absolute inset-0 [mask-image:linear-gradient(to_bottom,black,transparent_60%)]" />
        <div className="relative mx-auto max-w-[1200px] px-5 py-20 md:px-8 md:py-28"><WhyItMatters dark /></div>
      </section>

      {/* ── Funded in public ──────────────────────────────────── */}
      <section className="mx-auto max-w-[1200px] px-5 pt-24 md:px-8">
        <Eyebrow>Funded in public</Eyebrow>
        <h2 className="wide mt-5 max-w-4xl text-[36px] font-bold leading-[0.98] tracking-[-0.04em] md:text-[58px]">
          Every dollar in. <span className="text-ink/35">Every model call out.</span>
        </h2>
        <p className="mt-5 max-w-2xl text-[17px] leading-relaxed text-ink/65">Readers fund the runs. Each funded suite launches automatically with a hard spending cap, and every API call is priced on the <Link className="link" href="/costs">costs page</Link> within a minute.</p>
        <div className="mt-10 grid grid-cols-[minmax(0,1fr)] gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
          <LiveBudget initial={{ raised_usd: f.raised_cents / 100, pool_usd: f.pool_cents / 100, spent_usd: spend?.total_usd ?? null, spend_source: spend?.source ?? null, spend_as_of: spend?.as_of ?? null, donors: f.donors }} />
          <NextMilestoneCard f={f} showQueue={2} />
        </div>
      </section>

      {/* ── Findings bento ────────────────────────────────────── */}
      <section className="mx-auto max-w-[1200px] px-5 pt-24 md:px-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <Eyebrow>Latest findings</Eyebrow>
            <h2 className="wide mt-5 text-[36px] font-bold leading-[0.98] tracking-[-0.04em] md:text-[58px]">Findings<span className="text-vermilion">.</span></h2>
          </div>
          <Link href="/results" className="btn-ghost">All results →</Link>
        </div>
        <div className="mt-10 grid gap-3 md:grid-cols-2">
          {b.findings.map((x) => <FindingCard key={x.id} f={x} modelName={modelName(b, x.model)} example={b.is_example} />)}
        </div>
      </section>

      {/* ── Contributors + donor access ───────────────────────── */}
      <section className="mx-auto mt-24 grid max-w-[1200px] gap-3 px-5 md:grid-cols-[1.2fr_1fr] md:px-8">
        <div className="border border-rule p-6 md:p-8"><Leaderboard rows={leaders} title="Top contributors" /></div>
        <div className="ticks flex flex-col justify-between bg-vermilion p-6 text-white md:p-8">
          <div>
            <div className="kicker text-white/75">For donors</div>
            <div className="wide mt-4 text-[30px] font-bold leading-[1] tracking-[-0.03em]">See the reasoning, not just the score.</div>
            <p className="mt-4 text-[15px] leading-relaxed text-white/85">Anyone who donates, any amount, can sign in to read the exact prompts and the models&apos; reasoning traces behind every public result. Hold-out items stay private for everyone, so future models can&apos;t be trained on them.</p>
          </div>
          <div className="mt-8 flex gap-3"><Link href="/donate" className="btn border-ink bg-ink text-white hover:bg-white hover:text-ink">Donate</Link><Link href="/signin" className="btn border-white/40 text-white hover:border-white">Sign in</Link></div>
        </div>
      </section>
    </main>
  );
}
