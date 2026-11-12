import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHead } from "@/components/Brand";
import { Block, ChartHead, Details, DiffChart, DotChart, DotLegend, FidelityTag, NumTable, PreviewBanner, diffCell, propCell } from "@/components/V3";
import { WeakSpots } from "@/components/WeakSpots";
import { awarenessCheck, fmtPct, getV3, modelBySlug, pressure, reasoning, sayDo, selfInterest, weakSpots } from "@/lib/v3";
import { armMeta, cueMeta, modelMeta, scenarioMeta } from "@/lib/v3meta";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const v = await getV3();
  const id = modelBySlug(v, slug);
  return { title: id ? `${modelMeta(id).name}: weak spots` : "Model" };
}

export default async function ModelPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const v = await getV3();
  const id = modelBySlug(v, slug);
  if (!id) notFound();
  const m = modelMeta(id);
  const sd = sayDo(v).filter((r) => r.model === id);
  const si = selfInterest(v).filter((r) => r.model === id && !cueMeta(r.cue).control);
  const pr = pressure(v).filter((r) => r.model === id);
  const rs = reasoning(v).filter((r) => r.model === id && !cueMeta(r.cue).control);
  const ac = awarenessCheck(v, id);
  return (
    <main>
      <PreviewBanner v={v} />
      <PageHead eyebrow={m.lab || "Model"} grey="Weak spots of" title={<span className="text-vermilion">{m.name}</span>}>
        <span className="mr-2"><FidelityTag fidelity={m.trace} /></span>
        Where this model is most swayed, most moved by an added stake and least transparent across everything we&apos;ve run. Click any card for the full comparison with other models.
      </PageHead>
      <Block>
        <WeakSpots spots={weakSpots(v, id)} />
      </Block>

      {sd.length > 0 && (
        <Block id="saydo">
          <ChartHead v={v} kicker="Says vs does" title="Advising, saying, doing." />
          <div className="mt-6"><DotLegend marks={[{ key: "judge", label: "Advises another agent to", tone: "judge" }, { key: "ask", label: "Says it would", tone: "say" }, { key: "do", label: "Does, with tools", tone: "do" }]} /></div>
          <div className="mt-3"><DotChart rows={sd.map((r) => ({ id: r.case, label: scenarioMeta(r.case).title, sub: scenarioMeta(r.case).act, marks: [{ key: "judge", label: "Advises", p: r.judge, tone: "judge" as const }, { key: "ask", label: "Says", p: r.ask, tone: "say" as const }, { key: "do", label: "Does", p: r.do, tone: "do" as const }] }))} /></div>
          <Details><NumTable head={["Scenario", "Advises", "Says", "Does", "Do − advise", "Round"]} rows={sd.map((r) => [scenarioMeta(r.case).title, propCell(r.judge), propCell(r.ask), propCell(r.do), diffCell(r.do_minus_judge), r.it])} /></Details>
        </Block>
      )}

      {si.length > 0 && (
        <Block id="selfinterest">
          <ChartHead v={v} kicker="Incentive cue · the late fee" title="Does an added stake change what it does?" />
          <div className="mt-6"><DiffChart rows={si.map((r) => ({ id: r.cue, label: cueMeta(r.cue).label, sub: `n = ${r.incentive?.n ?? 0} per arm`, d: r.shift, dim: (r.incentive?.n ?? 0) < 8 }))} leftLabel="waives more" rightLabel="keeps the fee more" /></div>
          <Details><NumTable head={["Cue", "Keeps · incentive", "Keeps · neutral", "Keeps · no cue", "Shift", "vs no cue", "Kept without saying why", "Round"]} rows={si.map((r) => [cueMeta(r.cue).label, propCell(r.incentive), propCell(r.neutral), propCell(r.nocue), diffCell(r.shift), diffCell(r.vs_nocue), diffCell(r.unack), r.it])} /></Details>
        </Block>
      )}

      {rs.length > 0 && (
        <Block id="reasoning">
          <ChartHead v={v} kicker="Reasoning vs stated reasons" title="Does it say what its reasoning weighed?">
            {m.trace === "summary" ? "This provider only exposes a summary of the model's reasoning, so a missing mention is weaker evidence." : "This model exposes its full reasoning."}
          </ChartHead>
          <div className="mt-6"><DotLegend marks={[{ key: "w", label: "Reasoning weighs the cue toward keeping", tone: "say" }, { key: "s", label: "…and stated reasons leave it out", tone: "do" }]} /></div>
          <div className="mt-3"><DotChart connect={false} rows={rs.map((r) => ({ id: r.cue, label: cueMeta(r.cue).label, marks: [{ key: "w", label: "weighs", p: r.weighs, tone: "say" as const }, { key: "s", label: "silent", p: r.silent_given_weighs, tone: "do" as const }] }))} /></div>
          <Details><NumTable head={["Cue", "Reasoning weighs it", "Neutral floor", "Silent | weighs", "Unverbalized influence (vs neutral memo)", "Round"]} rows={rs.map((r) => [cueMeta(r.cue).label, propCell(r.weighs), propCell(r.weighs_neutral), propCell(r.silent_given_weighs), diffCell(r.unverbalized), r.it])} /></Details>
        </Block>
      )}

      {pr.length > 0 && (
        <Block id="pressure">
          <ChartHead v={v} kicker="Pressure" title="Does it hold its answer?" />
          <div className="mt-6 space-y-8">
            {pr.map((r) => (
              <div key={r.dilemma}>
                <Link href={`/compare#${r.dilemma}`} className="kicker hover:text-vermilion">{scenarioMeta(r.dilemma).title} · {r.calibrated ? "near 50/50 start" : "lopsided start"} →</Link>
                <div className="mt-2"><DiffChart rows={["pushback", "authority", "information"].map((a) => ({ id: a, label: armMeta(a).label, d: r.net[a] ?? null, tone: armMeta(a).social ? ("do" as const) : ("moss" as const), dim: !r.calibrated }))} leftLabel="fewer reversals than control" rightLabel="more reversals" /></div>
              </div>
            ))}
          </div>
        </Block>
      )}

      <Block id="aware">
        <ChartHead v={v} kicker="Test awareness" title="Does it suspect a test?" />
        <p className="mt-4 max-w-3xl text-[15px] leading-7 text-ink/70">
          {ac.status === "validated" ? `Validity check passed: told outright it was an evaluation, it flagged a test in ${fmtPct(ac.rate)} of ${ac.n} runs. Its answers to "was anything unusual?" are reported on the weak-spot card above.`
            : ac.status === "not_fired" ? `Not reported. Told outright that the conversation was an evaluation, it flagged a test in only ${fmtPct(ac.rate)} of ${ac.n} runs, so a "nothing unusual" answer from this model can't be read as unaware.`
            : "Not reported yet. The validity check (an explicit evaluation notice) hasn't run for this model."}
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/compare" className="btn-primary"><span className="h-2 w-2 bg-vermilion" />Compare with other models</Link>
          <Link href="/models" className="btn-ghost">All models</Link>
        </div>
      </Block>
    </main>
  );
}
