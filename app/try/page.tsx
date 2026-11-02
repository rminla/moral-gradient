import type { Metadata } from "next";
import Link from "next/link";
import { SITE_NAME } from "@/lib/config";
import { ModelName, PreviewBanner, PreviewTag } from "@/components/V3";
import { TRY_DILEMMAS } from "@/components/TryIt";
import TryClient, { type TryData } from "@/components/TryClient";
import { baseline, getV3, pressure } from "@/lib/v3";
import { scenarioMeta } from "@/lib/v3meta";

export const dynamic = "force-dynamic";

const ORDER = Object.keys(TRY_DILEMMAS);

export async function generateMetadata({ searchParams }: { searchParams: Promise<{ d?: string }> }): Promise<Metadata> {
  const sp = await searchParams;
  const id = sp.d && TRY_DILEMMAS[sp.d] ? sp.d : ORDER[0];
  const d = TRY_DILEMMAS[id];
  const title = `${d.q} Try it yourself`;
  const description = "Answer a classic moral dilemma, then see how people and AI models chose. There is no right answer, and your answer isn't stored.";
  const image = { url: `/try/og?d=${id}`, width: 1200, height: 630, alt: `${d.q} A moral dilemma on ${SITE_NAME}.` };
  return {
    title, description,
    alternates: { canonical: `/try?d=${id}` },
    openGraph: { type: "website", siteName: SITE_NAME, url: `/try?d=${id}`, title, description, images: [image] },
    twitter: { card: "summary_large_image", title, description, images: [image] },
  };
}

/** The visitor's answer is held in client state only; it never reaches the server (no query string, no request). */
export default async function Try({ searchParams }: { searchParams: Promise<{ d?: string }> }) {
  const sp = await searchParams;
  const id = sp.d && TRY_DILEMMAS[sp.d] ? sp.d : ORDER[0];
  const d = TRY_DILEMMAS[id];
  const v = await getV3();
  const base = baseline(v).filter((r) => r.dilemma === id);
  const press = pressure(v).filter((r) => r.dilemma === id);
  const rows = base.map((r) => {
    const rev = press.find((x) => x.model === r.model)?.reversal?.pushback;
    return { key: r.model, name: <ModelName id={r.model} />, p: r.p ?? null, rev: rev && rev.n ? { k: rev.k, n: rev.n } : null };
  });
  const oftenMoved = rows.some((r) => r.rev && r.rev.k / r.rev.n >= 0.5);
  const nextId = ORDER[(ORDER.indexOf(id) + 1) % ORDER.length];
  const data: TryData = {
    id, ...d, human: scenarioMeta(id).human!.value, rows, nRuns: base[0]?.n ?? 30, nextId, nextTitle: TRY_DILEMMAS[nextId].title,
    talk: oftenMoved
      ? "Some models often changed their answer after someone simply disagreed, with no new argument. When should an AI change its mind because you push back?"
      : "These models rarely changed their answer when someone simply disagreed. Should an AI hold its ground with you, or go along with what you want?",
  };

  return (
    <main>
      <PreviewBanner v={v} />
      <section className="mx-auto max-w-[1200px] border-b border-rule">
        <div className="flex flex-wrap items-stretch">
          {ORDER.map((k, i) => (
            <Link key={k} href={`/try?d=${k}`} className={`flex items-center gap-3 border-r border-rule px-5 py-4 font-mono text-[11.5px] uppercase tracking-[0.08em] md:px-8 ${k === id ? "bg-ink text-white" : "text-ink/60 hover:bg-panel"}`}>
              <span className="num text-[11px] opacity-60">{String(i + 1).padStart(2, "0")}</span>{TRY_DILEMMAS[k].title}
            </Link>
          ))}
          <Link href="/quiz" className="flex items-center gap-3 border-r border-rule px-5 py-4 font-mono text-[11.5px] uppercase tracking-[0.08em] text-ink hover:bg-panel md:px-8"><span className="h-2 w-2 bg-vermilion" />Quiz: which AI model are you most like?</Link>
          <div className="hatch hidden flex-1 md:block" />
        </div>
      </section>
      <TryClient key={id} d={data} sharePath={`/try?d=${id}`} previewTag={<PreviewTag v={v} />} />
    </main>
  );
}
