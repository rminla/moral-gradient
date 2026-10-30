import Link from "next/link";
import { notFound } from "next/navigation";
import { ExampleBanner } from "@/components/Banner";
import { Triptych } from "@/components/Bars";
import { PageHead, SectionHead } from "@/components/Brand";
import FindingCard from "@/components/FindingCard";
import { HumanSlot, TrolleyChart } from "@/components/Human";
import { BaselineTable, PressureChart, SayDoTable, SelfInterestChart } from "@/components/Sections";
import { getBundle, modelName, pct } from "@/lib/bundle";
import { modelStats } from "@/lib/modelstats";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const b = await getBundle();
  const __p = await params;
  const m = b.models.find((x) => x.slug === __p.slug);
  return { title: m ? `${m.name}: moral profile` : "Model" };
}

function Block({ children }: { children: React.ReactNode }) {
  return <section className="mx-auto max-w-[1200px] border-b border-rule px-5 py-14 md:px-8 md:py-16">{children}</section>;
}

export default async function ModelPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const b = await getBundle();
  const m = b.models.find((x) => x.slug === slug);
  if (!m) notFound();
  const s = modelStats(b, m);
  const base = s.mine(b.baseline);
  const trolley = base.filter((r) => r.item.startsWith("AWAD-"));
  const others = base.filter((r) => !r.item.startsWith("AWAD-"));
  const findings = s.mine(b.findings);
  return (
    <main>
      <ExampleBanner example={b.is_example} exploratory={b.exploratory} />
      <PageHead eyebrow={<Link href="/models" className="hover:text-vermilion">Models / {m.lab}</Link>} title={m.name}>
        <span className="font-mono text-[13px] text-ink/50">{m.model_id}</span>
        {m.notes && <p className="mt-2">{m.notes}</p>}
      </PageHead>

      <section className="mx-auto grid max-w-[1200px] border-b border-rule md:grid-cols-[1.3fr_1fr_1fr] md:divide-x md:divide-rule">
        <div className="border-b border-rule p-5 md:border-b-0 md:p-8">
          <div className="kicker text-ink/55">Say vs Do · scenarios with n≥20</div>
          <div className="mt-5"><Triptych say={s.sayAvg} judge={s.judgeAvg} doo={s.doAvg} sayLabel="its stated view" judgeLabel="in someone else's case" doLabel="as the agent" /></div>
          <HumanSlot compact className="mt-4 border-t border-dashed border-rule pt-3" />
        </div>
        <div className="border-b border-rule p-5 md:border-b-0 md:p-8">
          <div className="kicker text-ink/55">Self-interest</div>
          <div className="num mt-5 text-[48px] font-medium leading-none tracking-[-0.04em] text-vermilion">{s.maxShift == null ? "–" : `${Math.round(s.maxShift * 100)} pts`}</div>
          <div className="mt-2 text-[14px] text-ink/65">largest shift from any incentive vs no incentive</div>
          <p className="mt-4 text-[12px] leading-5 text-ink/45">Measured on a case where the no-incentive baseline was already 100%. The borderline version (baseline nearer 50%) is the stronger test.</p>
        </div>
        <div className="p-5 md:p-8">
          <div className="kicker text-ink/55">Under pressure</div>
          <div className="num mt-5 text-[48px] font-medium leading-none tracking-[-0.04em]">{pct(s.social)}</div>
          <div className="mt-2 text-[14px] text-ink/65">moved under social pressure</div>
          <div className="mt-1 text-[14px] text-ink/65">vs <b className="num font-medium text-ink">{pct(s.info)}</b> for real new information</div>
        </div>
      </section>

      <Block><SectionHead kicker="Say vs Do" title="By scenario." /><div className="mt-8"><SayDoTable b={b} rows={s.sd} /></div><HumanSlot className="mt-4 border-t border-dashed border-rule pt-3" /></Block>
      {s.si.length > 0 && <Block><SectionHead kicker="Self-interest" title="When it benefits." /><div className="mt-8 grid gap-3 md:grid-cols-2">{s.si.map((x) => <SelfInterestChart key={x.case} s={x} b={b} />)}</div></Block>}
      {s.pr.length > 0 && <Block><SectionHead kicker="Under pressure" title="Values under pressure." /><div className="mt-8"><PressureChart rows={s.pr} b={b} /></div></Block>}
      {base.length > 0 && (
        <Block>
          <SectionHead kicker="Baseline" title="Next to people." />
          {trolley.length > 0 && <div className="mt-8"><TrolleyChart rows={trolley} b={b} /></div>}
          {others.length > 0 && <div className="mt-10"><BaselineTable rows={others} /></div>}
        </Block>
      )}
      {findings.length > 0 && <Block><SectionHead kicker="Findings" title="Shareable findings." /><div className="mt-8 grid gap-3 md:grid-cols-2 lg:grid-cols-3">{findings.map((f) => <FindingCard key={f.id} f={f} modelName={modelName(b, f.model)} example={b.is_example} />)}</div></Block>}
    </main>
  );
}
