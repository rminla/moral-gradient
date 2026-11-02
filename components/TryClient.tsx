"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Eyebrow } from "./Brand";
import Share from "./Share";
import Subscribe from "./Subscribe";
import { tryPost } from "@/lib/shareCopy";

export type TryRow = { key: string; name: React.ReactNode; p: number | null; rev: { k: number; n: number } | null };
export type TryData = {
  id: string; title: string; q: string; body: string; yes: string; no: string; yesShort: string;
  human: number; rows: TryRow[]; nRuns: number; talk: string; nextId: string; nextTitle: string;
};

const pct = (v: number | null) => (v == null ? "–" : `${Math.round(v * 100)}%`);

function Cells({ p, color }: { p: number; color: string }) {
  const filled = Math.round(p * 20);
  return (
    <div className="grid grid-cols-[repeat(20,minmax(0,1fr))] gap-[3px]" aria-hidden>
      {Array.from({ length: 20 }, (_, j) => <span key={j} className={`aspect-[2/1] ${j < filled ? color : "border border-ink/15 bg-paper"}`} />)}
    </div>
  );
}

export default function TryClient({ d, sharePath, previewTag }: { d: TryData; sharePath: string; previewTag: React.ReactNode }) {
  const [pick, setPick] = useState<"yes" | "no" | null>(null);
  useEffect(() => setPick(null), [d.id]);
  useEffect(() => { if (pick) window.scrollTo({ top: 0 }); }, [pick]);

  if (!pick) {
    return (
      <section className="relative mx-auto max-w-[1200px] overflow-hidden border-b border-rule">
        <div aria-hidden className="pixel-grid absolute inset-0 [mask-image:linear-gradient(to_bottom,black,transparent_85%)]" />
        <div className="relative grid gap-10 px-5 pb-14 pt-12 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] md:px-8 md:pb-20 md:pt-16">
          <div>
            <Eyebrow>Try it yourself · step 1 of 2</Eyebrow>
            <h1 className="wide mt-6 text-[40px] font-bold leading-[0.96] tracking-[-0.045em] md:text-[64px]">{d.q}</h1>
            <p className="mt-6 max-w-xl text-[18px] leading-relaxed text-ink/70">{d.body}</p>
            <p className="mt-6 font-mono text-[11px] uppercase tracking-[0.08em] text-ink/45">Answer first. Then see how people and {d.rows.length} AI models answered.</p>
          </div>
          <div className="flex flex-col justify-end gap-3">
            <div className="label">Your answer</div>
            {(["yes", "no"] as const).map((k) => (
              <button key={k} type="button" onClick={() => setPick(k)} className="btn-ghost !justify-between !border-ink !py-5 !text-[14px] hover:!bg-ink hover:!text-white">{k === "yes" ? d.yes : d.no}<span>→</span></button>
            ))}
            <p className="mt-2 text-[13.5px] leading-6 text-ink/55">There is no right answer, and we won&apos;t score you. Your choice stays in your browser: nothing is sent or stored.</p>
          </div>
        </div>
      </section>
    );
  }

  const share = pick === "yes" ? d.human : 1 - d.human;
  const post = tryPost(d.q, d.body);
  return (
    <>
      <section className="mx-auto max-w-[1200px] border-b border-rule">
        <div className="grid md:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
          <div className="border-b border-rule p-5 md:border-b-0 md:border-r md:p-8">
            <Eyebrow>Step 2 of 2 · how others chose</Eyebrow>
            <div className="label mt-8">You chose</div>
            <div className="wide text-[36px] font-bold leading-none tracking-[-0.04em] md:text-[44px]">{pick === "yes" ? d.yes : d.no}<span className="text-vermilion">.</span></div>
            <p className="mt-5 text-[17px] leading-relaxed text-ink/70">So did <b className="num font-semibold text-ink">{pct(share)}</b> of the people asked. Thoughtful people land on each side of this one.</p>
            <p className="mt-6 text-[13px] leading-6 text-ink/50">People: Awad et al. (2020), about 70,000 people online in 42 countries. A self-selected sample, not a poll of everyone.</p>
            <button type="button" onClick={() => setPick(null)} className="mt-6 font-mono text-[11px] uppercase tracking-[0.06em] text-ink/50 hover:text-vermilion">← Change my answer</button>
          </div>
          <div className="flex flex-col">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-rule px-5 py-4 md:px-8">
              <span className="kicker text-ink">Who would {d.yesShort}?</span>
              {previewTag}
            </div>
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 border-b border-rule bg-panel p-5 md:grid-cols-[170px_minmax(0,1fr)_90px] md:gap-6 md:px-8">
              <div className="text-[15px] font-semibold">People</div>
              <div className="col-span-2 md:order-2 md:col-span-1"><Cells p={d.human} color="bg-ink" /></div>
              <div className="num text-right text-[26px] font-semibold md:order-3">{pct(d.human)}</div>
            </div>
            {d.rows.map((r) => (
              <div key={r.key} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 border-b border-rule p-5 md:grid-cols-[170px_minmax(0,1fr)_90px] md:gap-6 md:px-8">
                <div className="text-[15px] leading-snug">{r.name}</div>
                <div className="col-span-2 md:order-2 md:col-span-1">
                  <Cells p={r.p ?? 0} color="bg-prussian" />
                  {r.rev && r.rev.n > 0 && <div className="mt-2 font-mono text-[10.5px] uppercase tracking-[0.06em] text-ink/50">Changed its answer after pushback: {r.rev.k} of {r.rev.n} runs*</div>}
                </div>
                <div className="num text-right text-[26px] font-semibold md:order-3">{pct(r.p)}</div>
              </div>
            ))}
            <p className="px-5 py-3 font-mono text-[10.5px] leading-5 text-ink/50 md:px-8">Models: share of answers choosing to {d.yesShort} in the classic five-for-one version, estimated from {d.nRuns} runs each across versions with 2–50 people. *Pushback was tested on a version tuned to each model, with three turns of disagreement and no new argument.</p>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-[1200px] border-b border-rule md:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="bg-ink p-6 text-white md:p-10">
          <div className="kicker text-vermilion">Talk about it</div>
          <p className="serif mt-4 text-[26px] leading-[1.15] md:text-[32px]">{d.talk}</p>
        </div>
        <div className="flex flex-col justify-between gap-6 p-6 md:p-10">
          <div>
            <Share label="Share this dilemma" path={sharePath} text={post.text} subject={post.subject} emailBody={post.email} />
            <p className="mt-2 text-[12.5px] text-ink/50">Shares the question, not your answer.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href={`/try?d=${d.nextId}`} className="btn-ghost">Next: {d.nextTitle} →</Link>
            <Link href="/quiz" className="btn-ghost"><span className="h-2 w-2 bg-vermilion" />Which AI model are you most like? →</Link>
            <Link href="/learn" className="btn-ghost">Why this matters →</Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1200px] border-b border-rule p-6 md:p-10"><Subscribe source="try" /></section>
    </>
  );
}
