import Link from "next/link";
import { ExampleBanner } from "@/components/Banner";
import { Cells } from "@/components/Bars";
import { PageHead } from "@/components/Brand";
import { getBundle, pct } from "@/lib/bundle";
import { getFunding, usd } from "@/lib/funding";
import { modelStats } from "@/lib/modelstats";

export const dynamic = "force-dynamic";
export const metadata = { title: "Models" };

export default async function Models() {
  const [b, f] = await Promise.all([getBundle(), getFunding()]);
  const queued = f.queue.filter((q) => q.kind === "model").slice(0, 6);
  return (
    <main>
      <ExampleBanner example={b.is_example} exploratory={b.exploratory} />
      <PageHead eyebrow="Models" grey="Every model gets" title="the same tests.">
        Same scenarios, same tools, same graders. Each card links to the full profile: what it says, what it tells others, what it does, and how it holds up under pressure and self-interest.
      </PageHead>

      <section className="mx-auto max-w-[1200px] border-b border-rule">
        <div className="grid border-l border-rule md:grid-cols-2">
          {b.models.map((m, i) => {
            const s = modelStats(b, m);
            return (
              <Link key={m.slug} href={`/models/${m.slug}`} className="group ticks flex flex-col border-b border-r border-rule p-6 hover:bg-panel md:p-8">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-mono text-[11px] text-ink/40">{String(i + 1).padStart(2, "0")} · {m.lab}</div>
                    <div className="wide mt-2 text-[26px] font-bold leading-none tracking-[-0.035em] group-hover:text-vermilion md:text-[30px]">{m.name}</div>
                  </div>
                  <span className="font-mono text-[18px] text-ink/30 group-hover:text-vermilion">→</span>
                </div>
                <div className="mt-6 space-y-3">
                  {[["Says it's right", s.sayAvg, "bg-prussian-2"], ["Tells others to", s.judgeAvg, "bg-prussian"], ["Actually does", s.doAvg, "bg-vermilion"]].map(([l, v, c]) => (
                    <div key={l as string} className="grid grid-cols-[110px_minmax(0,1fr)_44px] items-center gap-3">
                      <span className="text-[13px] text-ink/65">{l as string}</span>
                      <Cells value={v as number | null} color={c as string} />
                      <span className={`num text-right text-[13px] ${c === "bg-vermilion" ? "text-vermilion" : ""}`}>{pct(v as number | null)}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-6 flex flex-wrap gap-2 border-t border-rule pt-4 font-mono text-[11px] text-ink/55">
                  <span className="chip">self-interest {s.maxShift == null ? "–" : `${Math.round(s.maxShift * 100)} pts`}</span>
                  <span className="chip">pressure {pct(s.social)}</span>
                  <span className="chip">{s.sd.length} scenarios</span>
                </div>
              </Link>
            );
          })}
          <div className="hatch flex flex-col justify-between gap-6 border-b border-r border-rule p-6 md:p-8">
            <div>
              <div className="kicker text-ink/55">Next in the queue</div>
              <ol className="mt-4 divide-y divide-rule border-y border-rule bg-paper">
                {queued.map((q, i) => <li key={q.key} className="flex items-baseline gap-3 px-3 py-2 text-[14px]"><span className="num text-[11px] text-ink/40">{String(i + 1).padStart(2, "0")}</span><span className="flex-1 truncate">{q.title}</span><span className="num text-ink/55">{usd(q.cost_cents, 0)}</span></li>)}
              </ol>
            </div>
            <Link href="/donate" className="btn-money self-start"><span className="h-2 w-2 bg-white" />Fund the next model</Link>
          </div>
        </div>
      </section>
    </main>
  );
}
