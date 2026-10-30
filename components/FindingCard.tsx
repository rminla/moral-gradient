import Link from "next/link";
import type { Finding } from "@/lib/types";
import { HBar } from "./Bars";
import Share from "./Share";
import { ExampleTag } from "./Banner";

const pillarName: Record<string, string> = { saydo: "Say vs Do", pressure: "Under pressure", selfinterest: "Self-interest", baseline: "Baseline" };
const pillarColor: Record<string, string> = { saydo: "bg-say", pressure: "bg-judge", selfinterest: "bg-do", baseline: "bg-ink" };

export default function FindingCard({ f, modelName, example }: { f: Finding; modelName: string; example: boolean }) {
  return (
    <article className="card flex flex-col p-5">
      <div className="mb-3 flex items-center gap-2 text-xs">
        <span className="chip"><span className={`h-1.5 w-1.5 rounded-full ${pillarColor[f.pillar] || "bg-ink"}`} />{pillarName[f.pillar] || f.pillar}</span>
        <span className="text-black/50">{modelName}</span>
        <span className="ml-auto">{example ? <ExampleTag /> : <ExampleTag>Pilot · exploratory</ExampleTag>}</span>
      </div>
      <Link href={`/f/${f.id}`} className="group">
        <h3 className="serif text-xl leading-snug group-hover:underline">{f.headline}</h3>
      </Link>
      <div className="mt-2 font-mono text-2xl font-semibold tabular-nums">{f.stat}</div>
      <div className="text-xs text-black/55">{f.stat_label}</div>
      <p className="mt-3 text-sm leading-6 text-black/70">{f.summary}</p>
      <div className="mt-4 space-y-2.5">
        {f.bars.slice(0, 4).map((b) => (
          <HBar key={b.label} label={b.label} value={b.value} color={pillarColor[f.pillar] || "bg-ink"} />
        ))}
      </div>
      <div className="mt-auto flex items-center justify-between pt-5">
        <Link href={`/f/${f.id}`} className="text-xs font-semibold text-black/60 hover:text-black">Details →</Link>
        <Share path={`/f/${f.id}`} text={`${f.headline} ${f.stat} (${f.stat_label})`} compact />
      </div>
    </article>
  );
}
