import Link from "next/link";
import { ModelName, PreviewBanner, PreviewTag } from "@/components/V3";
import { TRY_DILEMMAS } from "@/components/TryIt";
import TryClient, { type TryData } from "@/components/TryClient";
import { SITE_URL } from "@/lib/config";
import { baseline, getV3, pressure } from "@/lib/v3";
import { scenarioMeta } from "@/lib/v3meta";

export const dynamic = "force-dynamic";
export const metadata = { title: "Try it yourself", description: "Answer a classic moral dilemma, then see how people and AI models answered. There is no right answer, and nothing you pick is stored." };

const ORDER = Object.keys(TRY_DILEMMAS);

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
          <span className="flex items-center border-r border-rule px-5 py-4 font-mono text-[11.5px] uppercase tracking-[0.08em] text-ink/30 md:px-8"><span className="num mr-3 text-[11px]">03</span>The late fee · soon</span>
          <div className="hatch hidden flex-1 md:block" />
        </div>
      </section>
      <TryClient key={id} d={data} shareUrl={`${SITE_URL}/try?d=${id}`} previewTag={<PreviewTag v={v} />} />
    </main>
  );
}
