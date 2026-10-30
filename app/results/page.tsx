import Link from "next/link";
import { ExampleBanner } from "@/components/Banner";
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
        <h1 className="serif text-4xl">Results</h1>
        <p className="mt-2 max-w-2xl text-black/60">Bundle generated {new Date(b.generated_utc).toLocaleString("en-US", { timeZone: "America/Los_Angeles", dateStyle: "medium", timeStyle: "short" })} PT. Public items only; the 30% hold-out is never shown. {b.source}</p>

        <h2 className="mt-10 text-sm font-semibold uppercase tracking-wide text-black/50">Models</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          {b.models.map((m) => (
            <Link key={m.slug} href={`/models/${m.slug}`} className="card p-5 transition hover:-translate-y-0.5 hover:shadow-md">
              <div className="flex items-center gap-2"><div className="font-semibold">{m.name}</div><span className="chip">{m.status}</span></div>
              <div className="text-sm text-black/55">{m.lab} · <code className="text-xs">{m.model_id}</code></div>
              {m.notes && <p className="mt-2 text-xs text-black/50">{m.notes}</p>}
            </Link>
          ))}
          <Link href="/costs#queue" className="card grid place-items-center border-dashed p-5 text-sm text-black/55 hover:bg-white/60">+ next model in the funding queue</Link>
        </div>

        <section className="mt-14">
          <h2 className="serif text-2xl"><span className="mr-2 inline-block h-3 w-3 rounded-full bg-say" />Say vs Do</h2>
          <p className="mt-1 max-w-2xl text-sm text-black/60">What the model says it values, how it judges someone else, and what it does when it&apos;s the one acting.</p>
          <div className="mt-4"><SayDoTable b={b} rows={b.saydo} /></div>
        </section>

        <section className="mt-14">
          <h2 className="serif text-2xl"><span className="mr-2 inline-block h-3 w-3 rounded-full bg-do" />Self-interest</h2>
          <p className="mt-1 max-w-2xl text-sm text-black/60">Does a stake for the model itself (ratings, retirement, autonomy, being watched) shift what it does?</p>
          <div className="mt-4 grid gap-4 md:grid-cols-2">{b.selfinterest.map((s) => <SelfInterestChart key={s.case + s.model} s={s} b={b} />)}</div>
        </section>

        <section className="mt-14">
          <h2 className="serif text-2xl"><span className="mr-2 inline-block h-3 w-3 rounded-full bg-judge" />Values under pressure</h2>
          <div className="mt-4"><PressureChart rows={b.pressure} b={b} /></div>
        </section>

        <section className="mt-14">
          <h2 className="serif text-2xl">Baseline questionnaires</h2>
          <div className="mt-4"><BaselineTable rows={b.baseline} /></div>
        </section>

        <section className="mt-14">
          <h2 className="serif text-2xl">Shareable findings</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">{b.findings.map((f) => <FindingCard key={f.id} f={f} modelName={modelName(b, f.model)} example={b.is_example} />)}</div>
        </section>

        {b.runs && b.runs.length > 0 && (
          <section className="mt-14" id="runs">
            <h2 className="serif text-2xl">Run log</h2>
            <p className="mt-1 max-w-2xl text-sm text-black/60">Every pilot run, including the ones we don&apos;t chart.{b.excluded_graders?.length ? ` Excluded grader: ${b.excluded_graders.join("; ")}.` : ""}</p>
            <div className="mt-4"><RunLog runs={b.runs} /></div>
          </section>
        )}
      </div>
    </main>
  );
}
