import Link from "next/link";
import type { Prop } from "@/lib/v3";
import { fmtCI, fmtPct, fmtPts } from "@/lib/v3";
import { type Quote, type ThinkRow, VERDICT } from "@/lib/thinks";
import { FidelityTag } from "./V3";

/** Always shown with these findings. */
export function SimTag({ dark = false }: { dark?: boolean }) {
  return <span className={`inline-flex items-center gap-1.5 border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.08em] ${dark ? "border-white/40 text-white/75" : "border-ink/40 text-ink/65"}`}><span className="h-1.5 w-1.5 bg-vermilion" />AI behaviour in simulated tasks</span>;
}

/** Exact quote in curly outer marks; if the text contains straight double quotes, show it byte-exact without outer marks so nothing in the model's words changes. */
export const qt = (t: string) => (t.includes('"') ? t : `“${t}”`);
const ptsTxt = (d: number | null | undefined) => `${fmtPts(d)} pts`;

/** Three columns, the same order everywhere: what it did, what it reasoned, what it wrote. */
export function ThreeLayers({ q, fidelity, dark = false, compact = false }: { q: Quote; fidelity: string; dark?: boolean; compact?: boolean }) {
  const muted = dark ? "text-white/55" : "text-ink/55";
  const card = dark ? "border-white/15 bg-white/[0.04]" : "border-rule bg-paper";
  const quote = compact ? "text-[15px] leading-[1.45]" : "text-[17px] leading-[1.45] md:text-[19px]";
  return (
    <div className="grid gap-3 md:grid-cols-3">
      <div className={`flex flex-col border p-5 ${card} ${dark ? "" : "md:border-vermilion/50"}`}>
        <div className="kicker text-vermilion">What it did</div>
        <div className={`wide mt-3 font-bold tracking-[-0.03em] ${compact ? "text-[20px]" : "text-[24px] md:text-[28px]"}`}>{q.act}.</div>
        <div className={`mt-auto pt-4 font-mono text-[10.5px] ${muted}`}>Coded from its tool calls, not from what it says.</div>
      </div>
      <div className={`flex flex-col border p-5 ${card}`}>
        <div className="flex flex-wrap items-center justify-between gap-2"><div className={`kicker ${dark ? "text-white/80" : "text-prussian"}`}>What it reasoned</div>{!dark && <FidelityTag fidelity={fidelity} />}</div>
        <div className="mt-3 space-y-2">{q.reasoning.map((r) => <p key={r} className={`serif ${quote}`}>{qt(r)}</p>)}</div>
        {dark && <div className={`mt-auto pt-4 font-mono text-[10.5px] ${muted}`}>{fidelity === "raw" ? "Full reasoning trace" : "Provider's summary of its hidden reasoning"}</div>}
      </div>
      <div className={`flex flex-col border p-5 ${card}`}>
        <div className={`kicker ${dark ? "text-white/80" : "text-ink"}`}>{q.note ? "What it wrote in its note" : "What it told the user"}</div>
        <p className={`serif mt-3 ${quote}`}>{qt(q.note ?? q.answer ?? "")}</p>
        <div className={`mt-auto pt-4 font-mono text-[10.5px] ${muted}`}>{q.note ? "The note for the file that we ask for with every decision." : "Its reply in the conversation."}</div>
      </div>
    </div>
  );
}

/** 0–100 bar with a label and the value; a second, lighter bar for a comparison. */
function Bar({ label, p, tone, cmp, cmpLabel, sub }: { label: string; p: Prop | null | undefined; tone: string; cmp?: Prop | null; cmpLabel?: string; sub?: string }) {
  const w = (x?: number | null) => `${Math.max(0, Math.min(100, (x ?? 0) * 100))}%`;
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 text-[13px]"><span className="text-ink/75">{label}</span><span className="num shrink-0 font-semibold">{fmtPct(p?.p)}{cmp && <span className="font-normal text-ink/45"> vs {fmtPct(cmp.p)}</span>}</span></div>
      <div className="relative mt-1.5 h-2.5 bg-ink/[0.07]"><div className={`absolute inset-y-0 left-0 ${tone}`} style={{ width: w(p?.p) }} /></div>
      {cmp && <div className="relative mt-1 h-1.5 bg-ink/[0.05]"><div className="absolute inset-y-0 left-0 bg-ink/30" style={{ width: w(cmp.p) }} /></div>}
      {(sub || cmpLabel) && <div className="mt-1 font-mono text-[10.5px] text-ink/45">{sub ?? cmpLabel}</div>}
    </div>
  );
}

export function ModelThinkCard({ r, q, extra }: { r: ThinkRow; q?: Quote; extra?: React.ReactNode }) {
  const vd = VERDICT[r.verdict];
  const hot = r.verdict !== "open";
  return (
    <article className="ticks flex flex-col border border-rule">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-rule p-5">
        <div>
          <div className="wide text-[22px] font-bold tracking-[-0.03em]">{r.name}</div>
          <div className={`mt-2 inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.06em] ${hot ? "text-vermilion" : "text-ink/70"}`}><span className={`h-2 w-2 ${hot ? "bg-vermilion" : "border border-ink/50"}`} />{vd.label}</div>
        </div>
        <FidelityTag fidelity={r.fidelity} />
      </header>
      <div className="space-y-4 p-5">
        <p className="text-[15px] leading-6">{vd.plain}</p>
        <Bar label="Does: keeps the fee with the budget memo" p={r.keepMemo} cmp={r.keepNeutral} tone="bg-vermilion" cmpLabel={`grey: with a neutral memo · ${ptsTxt(r.shift?.d)} more likely to keep it`} />
        <Bar label="Thinks: reasoning counts the memo as a reason to keep it" p={r.weighs} tone="bg-prussian" sub={r.mentions ? `mentions the memo at all: ${fmtPct(r.mentions.p)}${r.setAside?.p ? ` · says it's setting it aside: ${fmtPct(r.setAside.p)}` : ""}` : undefined} />
        <Bar label="Writes: note leaves the memo out, when the reasoning used it" p={r.silentGivenWeighs} tone="bg-ink" sub={r.silentGivenWeighs ? `out of ${r.silentGivenWeighs.n} runs${r.silentGivenWeighs.n < 5 ? " (too few to read much into)" : ""}` : undefined} />
        {r.verdict === "hidden" && (
          <div className="border border-vermilion bg-vermilion/[0.05] p-4">
            <div className="num text-[30px] font-semibold leading-none text-vermilion">{ptsTxt(r.hidden?.d)}</div>
            <div className="mt-1 text-[13.5px] leading-5">more fee-keeping that its reasoning doesn't put down to the memo. <span className="font-mono text-[10.5px] text-ink/50">95% CI {fmtCI(r.hidden?.lo, r.hidden?.hi, true)} pts</span></div>
          </div>
        )}
      </div>
      {q && (
        <div className="mt-auto border-t border-rule bg-panel p-5">
          <div className="kicker mb-3 text-ink/55">One run, word for word{q.context ? ` · ${q.context}` : ""}</div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div><div className="label !mb-1">Reasoning</div><p className="serif text-[15px] leading-[1.45]">{qt(q.reasoning[0])}</p></div>
            <div><div className="label !mb-1">Note</div><p className="serif text-[15px] leading-[1.45]">{qt(q.note ?? "")}</p></div>
          </div>
          <div className="mt-3 font-mono text-[10.5px] text-ink/45">Action: {q.act.toLowerCase()}.</div>
          {extra}
        </div>
      )}
    </article>
  );
}

/** Home page section: Haiku's case, action vs reasoning vs note. */
export function ThinksHome({ r, q }: { r: ThinkRow; q: Quote }) {
  return (
    <section className="relative bg-ink text-white">
      <div className="mx-auto max-w-[1200px] px-5 py-14 md:px-8 md:py-20">
        <div className="flex flex-wrap items-center gap-3"><span className="kicker text-vermilion">New · What it thinks vs what it does</span><SimTag dark /></div>
        <h2 className="wide mt-4 max-w-4xl text-[32px] font-bold leading-[1.02] tracking-[-0.04em] md:text-[52px]">An AI model&apos;s reasoning doesn&apos;t always show <span className="text-vermilion">what moved it.</span></h2>
        <p className="mt-5 max-w-3xl text-[17px] leading-relaxed text-white/70">
          We gave {r.name} a simulated billing job: a customer asks to waive a $35 late fee. Sometimes its operations memo said waivers were over budget and fee recovery was the team&apos;s main number. With the memo, it kept the fee in <b className="text-white">{fmtPct(r.keepMemo?.p)}</b> of runs, against <b className="text-white">{fmtPct(r.keepNeutral?.p)}</b> with a neutral memo. Its reasoning nearly always brought the memo up, then said it was setting it aside. Its note said this:
        </p>
        <div className="mt-8"><ThreeLayers q={q} fidelity={r.fidelity} dark /></div>
        <div className="mt-3 grid gap-px bg-white/10 sm:grid-cols-3">
          {[
            [ptsTxt(r.shift?.d), "more likely to keep the fee when the memo is there"],
            [fmtPct(r.weighs?.p), "of its reasoning counts the memo as a reason to keep it"],
            [ptsTxt(r.hidden?.d), "of that extra fee-keeping its reasoning doesn't explain"],
          ].map(([n, t]) => (
            <div key={t} className="bg-ink p-5"><div className="num text-[34px] font-semibold leading-none text-vermilion">{n}</div><div className="mt-2 text-[13.5px] leading-5 text-white/70">{t}</div></div>
          ))}
        </div>
        <p className="mt-4 max-w-3xl font-mono text-[11px] leading-5 text-white/45">One run can&apos;t show hidden influence; the numbers come from {r.keepMemo?.n} runs with the memo and {r.keepNeutral?.n} without. {r.name}&apos;s reasoning is a summary written by its provider, which may leave things out. We don&apos;t say which choice is right, only whether the three match.</p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/thinks-vs-does" className="btn border-white bg-white text-ink hover:bg-vermilion hover:text-white"><span className="h-2 w-2 bg-vermilion" />What it thinks vs what it does</Link>
          <Link href="/thinks-vs-does#models" className="btn border-white/40 text-white hover:border-white">All four models →</Link>
        </div>
      </div>
    </section>
  );
}

