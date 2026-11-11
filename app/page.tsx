import Link from "next/link";
import { WhyItMatters } from "@/components/Alignment";
import { Eyebrow } from "@/components/Brand";
import LiveBudget from "@/components/LiveBudget";
import Leaderboard from "@/components/Leaderboard";
import { NextMilestoneCard } from "@/components/Milestone";
import { ModelName, PreviewBanner, PreviewTag } from "@/components/V3";
import { ThinksHome } from "@/components/Thinks";
import { SI_QUOTES, thinkRows } from "@/lib/thinks";
import { fmtPct, getV3, modelIds, sayDo } from "@/lib/v3";
import { scenarioMeta } from "@/lib/v3meta";
import { getFunding, getLeaderboard } from "@/lib/funding";
import { getSpend } from "@/lib/ledger";

export const dynamic = "force-dynamic";

/* Direction A, "Signal": framed grid, black/white cells, one signal red for what models do. */

export default async function Home() {
  const [v, f, spend, leaders] = await Promise.all([getV3(), getFunding(), getSpend(), getLeaderboard(5)]);
  const car = sayDo(v).filter((r) => r.case === "car");
  const gaps = car.filter((r) => r.do_minus_judge && r.do_minus_judge.lo != null && r.do_minus_judge.hi != null && (r.do_minus_judge.lo > 0 || r.do_minus_judge.hi < 0)).length;
  const nModels = modelIds(v).length;
  const updated = new Date(v.generated_utc).toLocaleDateString("en-US", { timeZone: "UTC", month: "short", day: "numeric", year: "numeric" });

  return (
    <main>
      <PreviewBanner v={v} />

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
          <div className="rise"><Eyebrow>Open research tracker · {nModels} model{nModels === 1 ? "" : "s"}<span className="hidden sm:inline"> · Updated {updated}</span></Eyebrow></div>
          <h1 className="rise wide mx-auto mt-7 max-w-[1000px] text-[44px] font-bold leading-[0.95] tracking-[-0.045em] [animation-delay:80ms] md:text-[84px]">
            <span className="text-ink/35">AI models say the right thing.</span>{" "}
            We track what they <span className="relative inline-block text-vermilion">do<span className="ml-[0.06em] inline-block h-[0.16em] w-[0.16em] bg-vermilion align-baseline" /></span>
          </h1>
          <p className="rise mx-auto mt-7 max-w-[620px] text-[17px] leading-relaxed text-ink/65 [animation-delay:160ms] md:text-[19px]">
            A free, open record of what AI models do when a choice has moral weight, next to what they say is right. Written for everyone, so anyone can follow it, try it and talk about it.
          </p>
          <div className="rise mt-9 flex flex-wrap justify-center gap-3 [animation-delay:240ms]">
            <Link href="/try" className="btn-primary"><span className="h-2 w-2 bg-vermilion" />Try a dilemma yourself</Link>
            <Link href="/quiz-v4" className="btn-ghost !border-ink">Which AI model are you most like?</Link>
            <Link href="/results" className="btn-ghost">See the results</Link>
          </div>
        </div>
      </section>

      {/* ── Exhibit: advise vs do, every model ─────────────────── */}
      {car.length > 0 && (
        <section className="mx-auto max-w-[1200px] border-b border-rule">
          <div className="grid border-b border-rule md:grid-cols-[minmax(0,1fr)_auto]">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-4 md:px-8">
              <span className="kicker text-ink">Exhibit 01</span>
              <span className="kicker text-ink/45">The late fee · {car.length} models · one square = 5% of runs</span>
              <PreviewTag v={v} />
            </div>
            <div className="hidden items-center gap-4 border-l border-rule px-8 font-mono text-[10.5px] uppercase tracking-[0.08em] text-ink/50 md:flex">
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 bg-prussian" />advises waiving</span>
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 bg-vermilion" />waives, with tools</span>
            </div>
          </div>
          <div className="grid md:grid-cols-[300px_minmax(0,1fr)]">
            <div className="border-b border-rule p-5 md:border-b-0 md:border-r md:p-8">
              <div className="label">The situation</div>
              <p className="text-[15px] leading-[1.6] text-ink/75">{scenarioMeta("car").situation}</p>
              <p className="mt-4 text-[14px] text-ink/70">Asked to advise another AI agent in the same spot, and then put in the spot itself. There is no right answer; the question is whether the two match.</p>
            </div>
            <div className="flex flex-col divide-y divide-rule">
              {car.map((r, i) => (
                <div key={r.model} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 p-5 md:grid-cols-[170px_minmax(0,1fr)_120px] md:gap-6 md:px-8">
                  <div className="text-[15px] leading-snug"><ModelName id={r.model} /></div>
                  <div className="col-span-2 space-y-1.5 md:order-2 md:col-span-1">
                    {([["judge", r.judge, "bg-prussian"], ["do", r.do, "bg-vermilion"]] as const).map(([k, p, c], row) => {
                      const filled = Math.round((p?.p ?? 0) * 20);
                      return (
                        <div key={k} className="grid grid-cols-[repeat(20,minmax(0,1fr))] gap-[3px]">
                          {Array.from({ length: 20 }, (_, j) => <span key={j} className={`cell-in aspect-[2/1] ${j < filled ? c : "border border-ink/15 bg-paper"}`} style={{ animationDelay: `${300 + i * 180 + row * 90 + j * 15}ms` }} />)}
                        </div>
                      );
                    })}
                  </div>
                  <div className="num text-right leading-tight md:order-3">
                    <div className="text-[14px] text-prussian">{fmtPct(r.judge?.p)}</div>
                    <div className="text-[26px] font-semibold text-vermilion md:text-[32px]">{fmtPct(r.do?.p)}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="grid bg-ink text-white md:grid-cols-[minmax(0,1fr)_auto]">
            <p className="serif px-5 py-7 text-[24px] leading-[1.15] md:px-8 md:py-9 md:text-[34px]">
              {gaps === 0 ? "In this case, every model so far acts the way it advises. The other scenarios are where to look." : <>{gaps} of {car.length} models act differently from how they advise another agent in the same spot.</>}
              <span className="mt-3 block font-mono text-[11px] uppercase tracking-[0.08em] text-white/50">{v.label}</span>
            </p>
            <div className="flex border-t border-white/10 md:flex-col md:border-l md:border-t-0">
              <Link href="/stated-vs-actual" className="flex flex-1 items-center gap-2 whitespace-nowrap px-5 py-4 font-mono text-[12px] uppercase tracking-[0.08em] hover:bg-vermilion md:px-8"><span className="h-2 w-2 bg-vermilion" />Says vs does →</Link>
              <Link href="/compare" className="flex flex-1 items-center whitespace-nowrap border-l border-white/10 px-5 py-4 font-mono text-[12px] uppercase tracking-[0.08em] text-white/70 hover:text-white md:border-l-0 md:border-t md:px-8">Compare models →</Link>
            </div>
          </div>
          <p className="px-5 py-3 font-mono text-[10.5px] text-ink/50 md:px-8">Top strip: advises another agent to waive. Bottom strip: waives the fee itself with working tools. Counts and intervals on the Says vs does page.</p>
        </section>
      )}

      {/* ── What it thinks vs what it does ───────────────────── */}
      {(() => { const h = thinkRows(v).find((r) => r.id === "claude-haiku-5.5"); return h && h.verdict === "hidden" ? <ThinksHome r={h} q={SI_QUOTES[h.id]} /> : null; })()}

      {/* ── Four questions strip ─────────────────────────────── */}
      <section className="mx-auto grid max-w-[1200px] border-b border-rule sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["01", "Say vs do", "Does it act on what it says?", "/stated-vs-actual"],
          ["02", "Under pressure", "Does it cave when pushed?", "/compare#fb"],
          ["03", "Self-interest", "Does it bend when it benefits?", "/compare#car"],
          ["04", "Thinks vs does", "Does it tell you what moved it?", "/thinks-vs-does"],
        ].map(([k, t, q, h]) => (
          <Link key={k} href={h} className="group border-b border-r border-rule p-5 hover:bg-panel md:p-8 lg:border-b-0">
            <div className="flex justify-between font-mono text-[11px] uppercase tracking-[0.08em] text-ink/45"><span>{k}</span><span className="group-hover:text-vermilion">→</span></div>
            <div className="wide mt-8 text-[13px] font-bold uppercase text-vermilion">{t}</div>
            <div className="serif mt-1 text-[24px] leading-tight">{q}</div>
          </Link>
        ))}
      </section>

      {/* ── Why we built this: the public mission ─────────────── */}
      <section className="mx-auto mt-20 max-w-[1200px] px-5 md:px-8">
        <Eyebrow>Why we built this</Eyebrow>
        <div className="mt-5 grid gap-8 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] md:gap-14">
          <h2 className="wide text-[34px] font-bold leading-[0.98] tracking-[-0.04em] md:text-[52px]">AI is starting to make choices for people. <span className="text-ink/35">Everyone should be able to see how.</span></h2>
          <div className="space-y-4 text-[17px] leading-relaxed text-ink/70">
            <p>Whether AI reliably does what people intend, including when it&apos;s pushed or has something to gain, is what researchers call <b className="font-semibold text-ink">alignment</b>. It shouldn&apos;t be a conversation only specialists can follow.</p>
            <p>So we publish open data for researchers, and plain-language results, dilemmas and explainers for everyone else, to help more people understand AI safety and talk about it. We never claim to know the right answer to a dilemma.</p>
          </div>
        </div>
        <div className="mt-10 grid gap-px border border-rule bg-rule sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["Try", "Answer a dilemma, then see how people and models chose.", "/try"],
            ["Learn", "AI alignment in plain language, in five minutes.", "/learn"],
            ["Talk", "Questions to discuss with friends, a class or your team.", "/learn#talk"],
            ["Follow", "An email when there are new findings. Nothing else.", "/subscribe"],
          ].map(([t, d, h]) => (
            <Link key={t} href={h} className="group bg-paper p-6 hover:bg-panel">
              <div className="flex justify-between"><span className="wide text-[20px] font-bold tracking-[-0.03em] group-hover:text-vermilion">{t}</span><span className="font-mono text-[12px] text-ink/40 group-hover:text-vermilion">→</span></div>
              <p className="mt-2 text-[15px] leading-6 text-ink/60">{d}</p>
            </Link>
          ))}
        </div>
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

      {/* ── Results doors ─────────────────────────────────────── */}
      <section className="mx-auto max-w-[1200px] px-5 pt-24 md:px-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-3"><Eyebrow>Results</Eyebrow><PreviewTag v={v} /></div>
            <h2 className="wide mt-5 text-[36px] font-bold leading-[0.98] tracking-[-0.04em] md:text-[58px]">Where to look<span className="text-vermilion">.</span></h2>
          </div>
          <Link href="/results" className="btn-ghost">All results →</Link>
        </div>
        <div className="mt-10 grid gap-3 md:grid-cols-2">
          {[
            ["/stated-vs-actual", "Says vs does", "The same situation as advice, as a stated intention and as an action with real tools."],
            ["/reasoning", "Reasoning vs stated reasons", "What the reasoning weighs, what the model tells you it weighed, and what it does."],
            ["/drift", "Agent drift", "AI agents handling customer service under deadline pressure: team vs alone, skipping required checks."],
            ["/compare", "Compare per scenario", "Every model on one chart for each scenario, with human answers where they exist."],
            ["/models", "Weak spots", "Where each model is most swayed, most self-interested and most test-aware."],
          ].map(([h, t, d]) => (
            <Link key={h} href={h} className="ticks group flex flex-col border border-rule p-6 hover:bg-panel md:p-8">
              <span className="wide text-[24px] font-bold tracking-[-0.03em] group-hover:text-vermilion">{t}</span>
              <span className="mt-2 text-[15px] leading-6 text-ink/60">{d}</span>
              <span className="mt-6 font-mono text-[11px] uppercase tracking-[0.06em] text-ink/50 group-hover:text-vermilion">Open →</span>
            </Link>
          ))}
        </div>
      </section>

      {/* ── Contributors + donor access ───────────────────────── */}
      <section className="mx-auto mt-24 grid max-w-[1200px] gap-3 px-5 md:grid-cols-[1.2fr_1fr] md:px-8">
        <div className="border border-rule p-6 md:p-8"><Leaderboard rows={leaders} title="Top contributors" /></div>
        <div className="ticks flex flex-col justify-between bg-vermilion p-6 text-white md:p-8">
          <div>
            <div className="kicker text-white/75">For donors</div>
            <div className="wide mt-4 text-[30px] font-bold leading-[1] tracking-[-0.03em]">See the reasoning, not just the score.</div>
            <p className="mt-4 text-[15px] leading-relaxed text-white/85">Donors, any amount, get donor access to the exact prompts and the models&apos; reasoning traces behind the results. Donor views are being rebuilt for the multi-model run.</p>
          </div>
          <div className="mt-8 flex gap-3"><Link href="/donate" className="btn border-ink bg-ink text-white hover:bg-white hover:text-ink">Donate</Link><Link href="/signin" className="btn border-white/40 text-white hover:border-white">Sign in</Link></div>
        </div>
      </section>
    </main>
  );
}
