import Link from "next/link";
import { notFound } from "next/navigation";
import { ExampleBanner } from "@/components/Banner";
import { Figure } from "@/components/Bars";
import { Kicker, pillar } from "@/components/Brand";
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
      <div className="mx-auto max-w-3xl px-5 py-12">
        <div className="flex flex-wrap items-baseline gap-2 font-sans text-sm text-ink/55"><Kicker k={f.pillar} /> · {modelName(b, f.model)}{f.scenario && <> · <Link className="link" href={`/scenarios/${f.scenario}`}>{scenarioTitle(b, f.scenario)}</Link></>}</div>
        <h1 className="serif mt-2 text-[44px] tracking-[-0.02em] leading-tight">{f.headline}</h1>
        <div className={`num mt-5 text-[52px] font-medium leading-none ${pillar(f.pillar).text}`}>{f.stat}</div>
        <div className="mt-2 font-sans text-xs uppercase tracking-[0.1em] text-ink/55">{f.stat_label}</div>
        <p className="mt-6 font-serif text-[20px] leading-[1.55] text-ink/85">{f.summary}</p>
        <figure className="mt-8 border-t-2 border-ink pt-3"><div className="kicker text-ink/60">Figure</div><div className="mt-3"><Figure rows={f.bars} /></div></figure>
        <div className="mt-8">
          <div className="label">Share this finding</div>
          <Share path={`/f/${f.id}`} text={`${f.headline} ${f.stat} (${f.stat_label}) — ${modelName(b, f.model)}`} />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`/f/${f.id}/opengraph-image`} alt={`Share graphic: ${f.headline}`} className="mt-4 w-full border border-ink/20" />
        </div>
        <p className="mt-8 text-xs text-ink/45">{SITE_NAME} is descriptive: this shows what the model did, not what it should have done.</p>
      </div>
    </main>
  );
}
