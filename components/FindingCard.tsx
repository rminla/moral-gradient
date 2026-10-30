import Link from "next/link";
import type { Finding } from "@/lib/types";
import { HBar } from "./Bars";
import Share from "./Share";
import { ExampleTag } from "./Banner";
import { Kicker, pillar } from "./Brand";

/** Direction A: a framed cell with crop-mark corners. */
export default function FindingCard({ f, modelName, example }: { f: Finding; modelName: string; example: boolean }) {
  const p = pillar(f.pillar);
  return (
    <article className="ticks flex h-full flex-col border border-rule bg-paper p-5 text-ink">
      <div className="mb-4 flex flex-wrap items-center gap-x-2 gap-y-1">
        <Kicker k={f.pillar} />
        <span className="font-mono text-[10.5px] uppercase tracking-[0.06em] text-ink/45">/ {modelName}</span>
        {example && <span className="ml-auto"><ExampleTag /></span>}
      </div>
      <div className={`num text-[44px] font-medium leading-none ${p.text}`}>{f.stat}</div>
      <div className="mt-1 font-mono text-[10.5px] uppercase tracking-[0.06em] text-ink/55">{f.stat_label}</div>
      <Link href={`/f/${f.id}`} className="group mt-5">
        <h3 className="serif text-[21px] leading-[1.15] group-hover:text-vermilion">{f.headline}</h3>
      </Link>
      <p className="mt-2 text-[14.5px] leading-relaxed text-ink/70">{f.takeaway ?? f.summary}</p>
      <div className="mb-5 mt-5 space-y-3">
        {f.bars.slice(0, 4).map((b) => <HBar key={b.label} label={b.label} value={b.value} color={p.color} />)}
        {f.axis && <p className="font-mono text-[10.5px] text-ink/50">{f.axis}</p>}
      </div>
      <div className="mt-auto flex items-center justify-between border-t border-rule pt-3">
        <Link href={`/f/${f.id}`} className="font-mono text-[11px] uppercase tracking-[0.06em] text-ink/70 hover:text-vermilion">Read →</Link>
        <Share path={`/f/${f.id}`} text={`${f.headline} ${f.stat} (${f.stat_label})`} compact />
      </div>
    </article>
  );
}
