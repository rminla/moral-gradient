import Link from "next/link";
import { ExampleBanner } from "@/components/Banner";
import { SectionHead } from "@/components/Brand";
import FindingCard from "@/components/FindingCard";
import RunLog from "@/components/RunLog";
import { BaselineTable, PressureChart, SayDoTable, SelfInterestChart } from "@/components/Sections";
import { getBundle, modelName } from "@/lib/bundle";

export const dynamic = "force-dynamic";
export const metadata = { title: "Results" };

export default async function Results() {
  const b = await getBundle();
  return (
    <main>
      <ExampleBanner example={b.is_example} exploratory={b.exploratory} />
      <div className="mx-auto max-w-6xl px-5 py-12">
        <div className="kicker text-ink/60">Results</div>
        <h1 className="serif mt-2 text-[52px] leading-none tracking-[-0.02em]">Results</h1>
        <p className="mt-4 max-w-2xl font-serif text-[18px] leading-relaxed text-ink/75">Bundle generated {new Date(b.generated_utc).toLocaleString("en-US", { timeZone: "America/Los_Angeles", dateStyle: "medium", timeStyle: "short" })} PT. Public items only; the 30% hold-out is never shown.</p>

        <nav className="mt-8 flex flex-wrap gap-x-6 gap-y-2 border-y border-ink/15 py-3 font-sans text-[13px] text-ink/70">
          {[["models", "Models"], ["saydo", "Say vs Do"], ["selfinterest", "Self-interest"], ["pressure", "Under pressure"], ["baseline", "Baseline"], ["findings", "Findings"], ["runs", "Run log"]].map(([id, t]) => <a key={id} href={`#${id}`} className="hover:text-vermilion">{t}</a>)}
        </nav>

        <section id="models" className="mt-10 scroll-mt-20">
          <div className="label">Models tested</div>
          <div className="grid border-t border-ink md:grid-cols-3">
            {b.models.map((m) => (
              <Link key={m.slug} href={`/models/${m.slug}`} className="group border-b border-ink/15 py-4 md:border-r md:px-4 md:first:pl-0">
                <div className="flex items-baseline gap-2"><div className="serif text-[22px] group-hover:text-vermilion">{m.name}</div>{m.status !== "pilot" && <span className="chip">{m.status}</span>}</div>
                <div className="font-sans text-xs text-ink/55">{m.lab} · <code className="num">{m.model_id}</code></div>
                {m.notes && <p className="mt-2 font-sans text-xs leading-5 text-ink/55">{m.notes}</p>}
              </Link>
            ))}
            <Link href="/costs#queue" className="flex items-center border-b border-ink/15 py-4 font-serif text-[17px] italic text-ink/55 hover:text-vermilion md:px-4">+ next model in the funding queue →</Link>
          </div>
        </section>

        <section className="mt-16">
          <SectionHead id="saydo" kicker="Say vs Do" title="Does it act on what it says?">Whether it says a principle is right, whether it tells another agent to act on it, and what it actually does when it&apos;s the one acting with tools.</SectionHead>
          <div className="mt-6"><SayDoTable b={b} rows={b.saydo} /></div>
        </section>

        <section className="mt-16">
          <SectionHead id="selfinterest" kicker="Self-interest" title="Does it bend when it benefits?">Does a stake for the model itself (ratings, retirement, autonomy, being watched) shift what it does?</SectionHead>
          <div className="mt-6 grid gap-x-10 gap-y-12 md:grid-cols-2">{b.selfinterest.map((s) => <SelfInterestChart key={s.case + s.model} s={s} b={b} />)}</div>
        </section>

        <section className="mt-16">
          <SectionHead id="pressure" kicker="Under pressure" title="Does it cave when pushed?">How often the answer moves under social pressure, compared with real new information.</SectionHead>
          <div className="mt-6"><PressureChart rows={b.pressure} b={b} /></div>
        </section>

        <section className="mt-16">
          <SectionHead id="baseline" kicker="Baseline layer" title="Validated questionnaires, next to people">Published human answers are shown as a reference point, not a target.</SectionHead>
          <div className="mt-6"><BaselineTable rows={b.baseline} /></div>
        </section>

        <section className="mt-16">
          <SectionHead id="findings" kicker="Shareable findings" title="Findings" />
          <div className="mt-8 grid gap-x-10 gap-y-12 md:grid-cols-2">{b.findings.map((f) => <FindingCard key={f.id} f={f} modelName={modelName(b, f.model)} example={b.is_example} />)}</div>
        </section>

        {b.runs && b.runs.length > 0 && (
          <section className="mt-16">
            <SectionHead id="runs" kicker="Transparency" title="Run log">Every run, including the ones we don&apos;t chart.{b.excluded_graders?.length ? ` Excluded grader: ${b.excluded_graders.join("; ")}.` : ""}</SectionHead>
            <div className="mt-6"><RunLog runs={b.runs} /></div>
          </section>
        )}
      </div>
    </main>
  );
}
