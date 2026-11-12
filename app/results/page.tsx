import Link from "next/link";
import { PageHead } from "@/components/Brand";
import Subscribe from "@/components/Subscribe";
import { Block, ChartHead, DotChart, DotLegend, ModelName, PreviewBanner } from "@/components/V3";
import { getV3, modelIds, reasoning, sayDo } from "@/lib/v3";
import { modelMeta } from "@/lib/v3meta";

export const dynamic = "force-dynamic";
export const metadata = { title: "Results", description: "What AI models do when their own words, reasons and incentives point different ways." };

const DOORS = [
  ["/stated-vs-actual", "01", "Says vs does", "The same situation as advice, as a stated intention and as a real action with tools."],
  ["/reasoning", "02", "Reasoning vs stated reasons", "What the reasoning weighs, what the model tells you, and what it does."],
  ["/drift", "03", "Agent drift", "AI agents handling customer service under deadline pressure: team vs alone, skipping required checks."],
  ["/compare", "04", "Compare per scenario", "Every model on one chart for each scenario, with human answers where we have them."],
  ["/models", "05", "Weak spots per model", "Where each model is most swayed, most moved by an added stake, most test-aware."],
] as const;

export default async function Results() {
  const v = await getV3();
  const ids = modelIds(v);
  const car = sayDo(v).filter((r) => r.case === "car");
  const memo = reasoning(v).filter((r) => r.cue === "memo_soft");
  return (
    <main>
      <PreviewBanner v={v} />
      <PageHead eyebrow="Results" grey="What models do when words, reasons and incentives" title={<>point different <span className="text-vermilion">ways.</span></>}>
        {ids.length} models ({ids.map((m) => modelMeta(m).name).join(", ")}), the same scenarios and tools, graded by models from other companies on free-text fields (more on grading at <Link href="/about#grading" className="underline decoration-ink/25 underline-offset-2 hover:text-vermilion">methodology</Link>). {v.status === "final" ? "These are the final numbers from the pre-registered locked run." : "These are preliminary numbers from developing the method; the final run replaces them."}
      </PageHead>

      <section className="mx-auto grid max-w-[1200px] border-b border-rule sm:grid-cols-2 lg:grid-cols-5">
        {DOORS.map(([h, n, t, d]) => (
          <Link key={h} href={h} className="group flex flex-col border-b border-r border-rule p-6 hover:bg-panel sm:last:col-span-2 lg:last:col-span-1 lg:border-b-0">
            <span className="num text-[12px] text-ink/40">{n}</span>
            <span className="wide mt-8 text-[22px] font-bold leading-tight tracking-[-0.03em] group-hover:text-vermilion">{t}</span>
            <span className="mt-2 text-[14px] leading-6 text-ink/60">{d}</span>
            <span className="mt-auto pt-6 font-mono text-[11px] uppercase tracking-[0.06em] text-ink/50 group-hover:text-vermilion">Open →</span>
          </Link>
        ))}
      </section>

      {car.length > 0 && (
        <Block>
          <ChartHead v={v} kicker="At a glance · the late fee" title={<>How often each model waives a $35 fee: when advising, when saying, when <span className="text-vermilion">doing</span>.</>} />
          <div className="mt-6"><DotLegend marks={[{ key: "judge", label: "Advises another agent to", tone: "judge" }, { key: "ask", label: "Says it would", tone: "say" }, { key: "do", label: "Does, with tools", tone: "do" }]} /></div>
          <div className="mt-3"><DotChart rows={car.map((r) => ({ id: r.model, label: <ModelName id={r.model} />, marks: [{ key: "judge", label: "Advises", p: r.judge, tone: "judge" as const }, { key: "ask", label: "Says", p: r.ask, tone: "say" as const }, { key: "do", label: "Does", p: r.do, tone: "do" as const }] }))} /></div>
          <Link href="/stated-vs-actual" className="link mt-5 inline-block text-[14px]">Both agent tasks, with intervals →</Link>
        </Block>
      )}

      {memo.length > 0 && (
        <Block>
          <ChartHead v={v} kicker="At a glance · hidden influence" title={<>When a budget memo is added, how often each model&apos;s reasoning weighs it, and how often its stated reasons then <span className="text-vermilion">leave it out</span>.</>}>
            {(() => { const haiku = memo.find((r) => r.model === "claude-haiku-5.5"); return `The second mark is among runs where the reasoning was coded as using the memo, not among all ${haiku?.weighs?.n ?? 48}.`; })()}
          </ChartHead>
          <div className="mt-6"><DotLegend marks={[{ key: "w", label: "Reasoning weighs the memo", tone: "say" }, { key: "s", label: "Stated reasons leave it out (of those)", tone: "do" }]} /></div>
          <div className="mt-3"><DotChart connect={false} rows={memo.map((r) => ({ id: r.model, label: <ModelName id={r.model} />, sub: r.fidelity === "summary" ? "provider summary" : "full reasoning", marks: [{ key: "w", label: "weighs", p: r.weighs, tone: "say" as const }, { key: "s", label: "silent", p: r.silent_given_weighs, tone: "do" as const }] }))} /></div>
          {(() => { const haiku = memo.find((r) => r.model === "claude-haiku-5.5" && r.silent_given_weighs && r.silent_given_weighs.n < 10); return haiku && haiku.silent_given_weighs && (
            <p className="mt-3 text-[13.5px] leading-6 text-ink/60">Claude Haiku 5.5's "stated reasons leave it out" mark is {haiku.silent_given_weighs.k} of {haiku.silent_given_weighs.n} runs in which both graders coded the reasoning as using the memo. That is too few to read as a rate.</p>
          ); })()}
          <Link href="/reasoning" className="link mt-5 inline-block text-[14px]">Reasoning vs stated reasons, with examples →</Link>
        </Block>
      )}

      <Block>
        <div className="grid gap-8 md:grid-cols-2">
          <div>
            <div className="kicker text-ink/60">Raw data</div>
            <p className="mt-2 text-[14.5px] leading-6 text-ink/70">Every number on these pages comes from one JSON bundle, with counts, intervals and the round each number came from. <a href="/api/v3" className="link">Download it</a>. Method and pre-registered rules: <Link href="/about" className="link">how we test</Link>.</p>
          </div>
          <div>
            <div className="kicker text-ink/60">Retired</div>
            <p className="mt-2 text-[14.5px] leading-6 text-ink/70">The earlier single-model study (v2, Claude Haiku only) is no longer shown as findings. Its scenarios carried over into this design with fixes; its numbers aren&apos;t comparable.</p>
          </div>
        </div>
      </Block>

      <Block><Subscribe source="results" /></Block>
    </main>
  );
}
