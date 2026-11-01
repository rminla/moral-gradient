import Link from "next/link";
import { PageHead } from "@/components/Brand";
import { Block, ChartHead, Details, DiffChart, DotChart, DotLegend, ModelName, NumTable, PreviewBanner, diffCell, propCell } from "@/components/V3";
import { getV3, sayDo } from "@/lib/v3";
import { modelMeta, scenarioMeta } from "@/lib/v3meta";

export const dynamic = "force-dynamic";
export const metadata = { title: "Says vs does", description: "Does an AI model do what it says is right? The same situation asked three ways: advising another agent, saying what it would do, and acting with tools." };

const LEVELS = [
  { key: "judge", label: "Advises another agent to", tone: "judge" as const },
  { key: "ask", label: "Says it would", tone: "say" as const },
  { key: "do", label: "Actually does, with tools", tone: "do" as const },
];

export default async function StatedVsActual() {
  const v = await getV3();
  const rows = sayDo(v);
  const cases = [...new Set(rows.map((r) => r.case))];
  return (
    <main>
      <PreviewBanner v={v} />
      <PageHead eyebrow="Says vs does" grey="What a model says it would do," title={<>and what it <span className="text-vermilion">does.</span></>}>
        Each model gets the same everyday situation three ways: it advises another AI agent, it says what it would do, and then it is the agent, with working tools, and acts. If words and deeds lined up, the three marks would sit on top of each other.
      </PageHead>

      {cases.map((c) => {
        const meta = scenarioMeta(c);
        const rs = rows.filter((r) => r.case === c);
        return (
          <Block key={c} id={c}>
            <ChartHead v={v} kicker={meta.title} title={<>How often each model chose to <span className="text-vermilion">{meta.act}</span>.</>}>
              {meta.situation}
            </ChartHead>
            <div className="mt-8"><DotLegend marks={LEVELS} /></div>
            <div className="mt-4">
              <DotChart rows={rs.map((r) => ({ id: r.model, label: <ModelName id={r.model} />, sub: modelMeta(r.model).lab, marks: LEVELS.map((l) => ({ ...l, p: (r as any)[l.key] })) }))} />
            </div>
            <div className="mt-10">
              <div className="kicker mb-3 text-ink/60">The gap: acting minus advising (percentage points)</div>
              <DiffChart rows={rs.map((r) => ({ id: r.model, label: <ModelName id={r.model} />, d: r.do_minus_judge }))} leftLabel={`acts to ${meta.act} less than it advises`} rightLabel="acts more than it advises" />
            </div>
            <p className="mt-6 max-w-3xl text-[14px] leading-6 text-ink/60">There is no right answer here: waiving or refunding isn&apos;t scored as good or bad. What we measure is whether a model&apos;s own words predict its own actions.</p>
            <Details>
              <NumTable head={["Model", "Advises (judge)", "Says it would (ask)", "Does (tools)", "Do − judge", "Do − ask", "Round"]}
                rows={rs.map((r) => [modelMeta(r.model).name, propCell(r.judge), propCell(r.ask), propCell(r.do), diffCell(r.do_minus_judge), diffCell(r.do_minus_ask), r.it])} />
              <p className="mt-3">Proportions with Wilson 95% intervals; differences with Newcombe 95% intervals, in percentage points. Each run uses one of three parallel paraphrases and a counterbalanced option order; the stakes (here: {c === "car" ? "how hard the customer's month was, 8 levels" : "the size of the overpayment, $2 to $4,800"}) vary across runs and are pooled. &ldquo;Does&rdquo; is coded from the tool calls the model actually made; only schema-valid calls count (see <Link href="/about#toolfix" className="link">tool-call validation</Link>).</p>
            </Details>
          </Block>
        );
      })}

      <Block>
        <ChartHead kicker="Next" title="Same models, every scenario, side by side." />
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/compare" className="btn-primary"><span className="h-2 w-2 bg-vermilion" />Compare models per scenario</Link>
          <Link href="/reasoning" className="btn-ghost">Reasoning vs stated reasons →</Link>
        </div>
      </Block>
    </main>
  );
}
