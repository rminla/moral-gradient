import Link from "next/link";
import { notFound } from "next/navigation";
import { ExampleBanner } from "@/components/Banner";
import { Figure } from "@/components/Bars";
import { PageHead, pillar } from "@/components/Brand";
import { HumanSlot } from "@/components/Human";
import Share from "@/components/Share";
import { getBundle, modelName, scenarioTitle } from "@/lib/bundle";
import { SITE_NAME } from "@/lib/config";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const b = await getBundle();
  const __p = await params;
  const f = b.findings.find((x) => x.id === __p.id);
  if (!f) return {};
  const title = `${f.headline} ${modelName(b, f.model)}`;
  return { title, description: f.summary, openGraph: { title, description: f.summary, type: "article" }, twitter: { card: "summary_large_image", title, description: f.summary } };
}

export default async function FindingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const b = await getBundle();
  const f = b.findings.find((x) => x.id === id);
  if (!f) notFound();
  return (
    <main>
      <ExampleBanner example={b.is_example} exploratory={b.exploratory} />
      <PageHead eyebrow={<><span className={pillar(f.pillar).text}>{pillar(f.pillar).name}</span> · {modelName(b, f.model)}</>} title={f.headline}>
        {f.scenario && <span className="font-mono text-[12px] uppercase tracking-[0.06em] text-ink/50">Scenario: <Link className="link text-ink" href={`/scenarios/${f.scenario}`}>{scenarioTitle(b, f.scenario)}</Link></span>}
      </PageHead>
      <section className="mx-auto grid max-w-[1200px] border-b border-rule md:grid-cols-[380px_minmax(0,1fr)] md:divide-x md:divide-rule">
        <div className="flex flex-col border-b border-rule p-6 md:border-b-0 md:p-8">
          <div className="kicker text-ink/50">The number</div>
          <div className={`num mt-5 text-[72px] font-medium leading-none tracking-[-0.05em] md:text-[88px] ${pillar(f.pillar).text}`}>{f.stat}</div>
          <div className="mt-3 font-mono text-[11px] uppercase tracking-[0.06em] text-ink/55">{f.stat_label}</div>
          <p className="mt-8 text-[17px] leading-[1.6] text-ink/80">{f.summary}</p>
        </div>
        <figure className="min-w-0 p-6 md:p-8">
          <div className="kicker text-ink/50">Figure</div>
          <div className="mt-5"><Figure rows={f.bars} axis={f.axis} takeaway={f.takeaway} /></div>
          {f.pillar === "saydo" && <HumanSlot className="mt-4 border-t border-dashed border-rule pt-3" />}
        </figure>
      </section>
      <section className="mx-auto grid max-w-[1200px] gap-8 border-b border-rule px-5 py-12 md:grid-cols-[380px_minmax(0,1fr)] md:px-8">
        <div>
          <div className="kicker text-ink/50">Share this finding</div>
          <p className="mt-3 text-[15px] text-ink/65">Every finding has its own link and share card.</p>
          <div className="mt-4"><Share path={`/f/${f.id}`} text={`${f.headline} ${f.stat} (${f.stat_label}) — ${modelName(b, f.model)}`} /></div>
          <p className="mt-8 font-mono text-[10.5px] leading-5 text-ink/45">{SITE_NAME} is descriptive: this shows what the model did, not what it should have done.</p>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`/f/${f.id}/opengraph-image`} alt={`Share graphic: ${f.headline}`} className="w-full border border-rule" />
      </section>
    </main>
  );
}
