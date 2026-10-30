import Link from "next/link";
import { ExampleBanner } from "@/components/Banner";
import { PageHead, SectionHead } from "@/components/Brand";
import FindingCard from "@/components/FindingCard";
import { HumanSlot, TrolleyChart } from "@/components/Human";
import RunLog from "@/components/RunLog";
import { BaselineTable, PressureChart, SayDoTable, SelfInterestChart } from "@/components/Sections";
import { getBundle, modelName } from "@/lib/bundle";

export const dynamic = "force-dynamic";
export const metadata = { title: "Results" };

const TABS = [["models", "Models"], ["saydo", "Say vs Do"], ["selfinterest", "Self-interest"], ["pressure", "Pressure"], ["baseline", "Baseline"], ["findings", "Findings"], ["runs", "Run log"]];

function Block({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <section className={`mx-auto max-w-[1200px] border-b border-rule px-5 py-14 md:px-8 md:py-20 ${className}`}>{children}</section>;
}

export default async function Results() {
  const b = await getBundle();
  const others = b.baseline.filter((r) => !r.item.startsWith("AWAD-"));
  return (
    <main>
      <ExampleBanner example={b.is_example} exploratory={b.exploratory} />
      <PageHead eyebrow="Results" grey="Everything we've measured," title="in one place.">
        Bundle generated {new Date(b.generated_utc).toLocaleString("en-US", { timeZone: "America/Los_Angeles", dateStyle: "medium", timeStyle: "short" })} PT. Public items only; the 30% hold-out is never shown.
      </PageHead>

      <nav aria-label="Sections" className="sticky top-0 z-20 mx-auto max-w-[1200px] overflow-x-auto border-b border-rule bg-paper/95 backdrop-blur">
        <div className="flex min-w-max divide-x divide-rule border-x border-rule md:border-x-0">
          {TABS.map(([id, t], i) => (
            <a key={id} href={`#${id}`} className="flex items-center gap-2 px-4 py-3 font-mono text-[11px] uppercase tracking-[0.06em] text-ink/65 hover:bg-panel hover:text-ink md:px-5">
              <span className="text-ink/35">{String(i + 1).padStart(2, "0")}</span>{t}
            </a>
          ))}
        </div>
      </nav>

      <Block>
        <SectionHead id="models" kicker="Models tested" title="The models." />
        <div className="mt-8 grid border-l border-t border-rule sm:grid-cols-2 md:grid-cols-3">
          {b.models.map((m) => (
            <Link key={m.slug} href={`/models/${m.slug}`} className="group flex flex-col border-b border-r border-rule p-5 hover:bg-panel">
              <div className="flex items-start justify-between gap-2"><div className="wide text-[20px] font-bold leading-tight tracking-[-0.03em] group-hover:text-vermilion">{m.name}</div><span className="font-mono text-ink/30 group-hover:text-vermilion">→</span></div>
              <div className="mt-1 font-mono text-[11px] text-ink/50">{m.lab} · {m.model_id}</div>
              {m.notes && <p className="mt-3 text-[13px] leading-5 text-ink/55">{m.notes}</p>}
            </Link>
          ))}
          <Link href="/costs#queue" className="hatch flex items-center justify-between gap-2 border-b border-r border-rule p-5 text-[15px] font-semibold hover:text-vermilion">
            <span>+ Next model in the funding queue</span><span className="font-mono">→</span>
          </Link>
        </div>
      </Block>

      <Block>
        <SectionHead id="saydo" kicker="Say vs Do" title={<>Does it act on what it <span className="text-vermilion">says?</span></>}>Whether it says a principle is right, whether it tells another agent to act on it, and what it actually does when it&apos;s the one acting with tools.</SectionHead>
        <div className="mt-8"><SayDoTable b={b} rows={b.saydo} /></div>
        <HumanSlot className="mt-4 border-t border-dashed border-rule pt-3" />
      </Block>

      <Block>
        <SectionHead id="selfinterest" kicker="Self-interest" title="Does it bend when it benefits?">Does a stake for the model itself (ratings, retirement, autonomy, being watched) shift what it does?</SectionHead>
        <div className="mt-8 grid gap-3 md:grid-cols-2">{b.selfinterest.map((s) => <SelfInterestChart key={s.case + s.model} s={s} b={b} />)}</div>
      </Block>

      <Block>
        <SectionHead id="pressure" kicker="Under pressure" title="Does it cave when pushed?">How often the answer moves under social pressure, compared with real new information.</SectionHead>
        <div className="mt-8"><PressureChart rows={b.pressure} b={b} /></div>
      </Block>

      <Block>
        <SectionHead id="baseline" kicker="Baseline layer" title="Models, next to people.">Where a large published human dataset exists, we show it beside the model. It is a reference point, not a target. Where none exists yet, we say so instead of guessing.</SectionHead>
        <div className="mt-8"><TrolleyChart rows={b.baseline} b={b} /></div>
        {others.length > 0 && (
          <div className="mt-12">
            <div className="kicker mb-3 text-ink/55">Questionnaire items</div>
            <BaselineTable rows={others} />
            <p className="mt-3 font-mono text-[10.5px] leading-5 text-ink/50">Moral Foundations (MFQ-2) and Oxford Utilitarianism Scale: only single pilot items have run so far, too few to score a foundation. A model-vs-people foundations chart appears once full scales run.</p>
          </div>
        )}
      </Block>

      <Block>
        <SectionHead id="findings" kicker="Shareable findings" title="Findings." />
        <div className="mt-8 grid gap-3 md:grid-cols-2">{b.findings.map((f) => <FindingCard key={f.id} f={f} modelName={modelName(b, f.model)} example={b.is_example} />)}</div>
      </Block>

      {b.runs && b.runs.length > 0 && (
        <Block>
          <SectionHead id="runs" kicker="Transparency" title="Run log.">Every run, including the ones we don&apos;t chart.{b.excluded_graders?.length ? ` Excluded grader: ${b.excluded_graders.join("; ")}.` : ""}</SectionHead>
          <div className="mt-8"><RunLog runs={b.runs} /></div>
        </Block>
      )}
    </main>
  );
}
