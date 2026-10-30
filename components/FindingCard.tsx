import Link from "next/link";
import type { Finding } from "@/lib/types";
import { HBar } from "./Bars";
import Share from "./Share";
import { ExampleTag } from "./Banner";
import { Kicker, pillar } from "./Brand";

export default function FindingCard({ f, modelName, example }: { f: Finding; modelName: string; example: boolean }) {
  const p = pillar(f.pillar);
  return (
    <article className="flex flex-col border-t-2 border-ink pt-3">
      <div className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-1">
        <Kicker k={f.pillar} />
        <span className="font-sans text-[11px] text-ink/50">· {modelName}</span>
        <span className="ml-auto">{example ? <ExampleTag /> : <ExampleTag>Pilot · exploratory</ExampleTag>}</span>
      </div>
      <Link href={`/f/${f.id}`} className="group">
        <h3 className="serif text-[24px] leading-[1.15] tracking-[-0.01em] group-hover:text-vermilion">{f.headline}</h3>
      </Link>
      <div className={`num mt-3 text-[26px] font-medium ${p.text}`}>{f.stat}</div>
      <div className="font-sans text-[11px] uppercase tracking-[0.08em] text-ink/55">{f.stat_label}</div>
      <p className="mt-3 font-serif text-[16px] leading-relaxed text-ink/80">{f.summary}</p>
      <div className="mb-5 mt-4 space-y-2.5">
        {f.bars.slice(0, 4).map((b) => <HBar key={b.label} label={b.label} value={b.value} color={p.color} />)}
      </div>
      <div className="mt-auto flex items-center justify-between border-t border-ink/10 pt-3">
        <Link href={`/f/${f.id}`} className="font-sans text-xs font-medium text-ink/70 hover:text-vermilion">Read the finding →</Link>
        <Share path={`/f/${f.id}`} text={`${f.headline} ${f.stat} (${f.stat_label})`} compact />
      </div>
    </article>
  );
}
