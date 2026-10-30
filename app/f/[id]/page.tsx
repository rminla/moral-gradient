import Link from "next/link";
import { notFound } from "next/navigation";
import { ExampleBanner } from "@/components/Banner";
import { HBar } from "@/components/Bars";
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
        <div className="text-sm text-black/50">{modelName(b, f.model)}{f.scenario && <> · <Link className="underline" href={`/scenarios/${f.scenario}`}>{scenarioTitle(b, f.scenario)}</Link></>}</div>
        <h1 className="serif mt-2 text-4xl leading-tight">{f.headline}</h1>
        <div className="mt-4 font-mono text-5xl font-semibold tabular-nums">{f.stat}</div>
        <div className="text-black/55">{f.stat_label}</div>
        <p className="mt-6 text-lg leading-8 text-black/75">{f.summary}</p>
        <div className="card mt-8 space-y-3 p-5">{f.bars.map((x) => <HBar key={x.label} label={x.label} value={x.value} />)}</div>
        <div className="mt-8">
          <div className="label">Share this finding</div>
          <Share path={`/f/${f.id}`} text={`${f.headline} ${f.stat} (${f.stat_label}) — ${modelName(b, f.model)}`} />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`/f/${f.id}/opengraph-image`} alt={`Share graphic: ${f.headline}`} className="mt-4 w-full rounded-2xl border border-black/10 shadow-sm" />
        </div>
        <p className="mt-8 text-xs text-black/45">{SITE_NAME} is descriptive: this shows what the model did, not what it should have done.</p>
      </div>
    </main>
  );
}
