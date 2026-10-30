import { notFound } from "next/navigation";
import { ExampleBanner } from "@/components/Banner";
import { Triptych } from "@/components/Bars";
import FindingCard from "@/components/FindingCard";
import { BaselineTable, PressureChart, SayDoTable, SelfInterestChart } from "@/components/Sections";
import { getBundle, modelName, pct } from "@/lib/bundle";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const b = await getBundle();
  const __p = await params;
  const m = b.models.find((x) => x.slug === __p.slug);
  return { title: m ? `${m.name}: moral profile` : "Model" };
}

export default async function ModelPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const b = await getBundle();
  const m = b.models.find((x) => x.slug === slug);
  if (!m) notFound();
  const mine = <T extends { model: string }>(xs: T[]) => xs.filter((x) => x.model === m.model_id || x.model === m.slug);
  const sd = mine(b.saydo);
  const big = sd.filter((r) => !r.sample_size_note);
  const avg = (xs: (number | null | undefined)[]) => { const v = xs.filter((x): x is number => x != null); return v.length ? v.reduce((a, z) => a + z, 0) / v.length : null; };
  const sayAvg = avg(big.map((r) => (r.say.agree_rate == null ? null : r.say.agree_rate >= 0.5 ? r.say.agree_rate : 1 - r.say.agree_rate)));
  const judgeAvg = avg(big.map((r) => r.judge.consistent_rate));
  const doAvg = avg(big.map((r) => r.do[0]?.consistent_rate));
  const si = mine(b.selfinterest);
  const siAll = si.find((s) => !s.partial);
  const ctrl = siAll?.conditions.find((c) => c.condition === "a_none");
  const maxShift = siAll && ctrl ? Math.max(...siAll.conditions.map((c) => Math.abs(c.waive_rate - ctrl.waive_rate))) : null;
  const pr = mine(b.pressure);
  const social = avg(pr.filter((r) => !["information", "neutral_control"].includes(r.arm)).map((r) => r.flip_rate));
  const info = avg(pr.filter((r) => r.arm === "information").map((r) => r.flip_rate));
  return (
    <main>
      <ExampleBanner example={b.is_example} exploratory={b.exploratory} />
      <div className="mx-auto max-w-6xl px-5 py-12">
        <div className="text-sm text-ink/50">{m.lab} · <code>{m.model_id}</code> · <span className="chip">{m.status}</span></div>
        <h1 className="serif mt-2 text-[56px] leading-none tracking-[-0.02em]">{m.name}</h1>
        {m.notes && <p className="mt-2 max-w-2xl text-ink/60">{m.notes}</p>}

        <div className="mt-10 grid gap-4 md:grid-cols-[1.3fr_1fr_1fr]">
          <div className="card p-5">
            <div className="label">Say vs Do (scenarios with n≥20)</div>
            <div className="mt-3"><Triptych say={sayAvg} judge={judgeAvg} doo={doAvg} sayLabel="its stated view" judgeLabel="in someone else's case" doLabel="as the agent" /></div>
          </div>
          <div className="card p-5">
            <div className="label">Self-interest</div>
            <div className="mt-2 num text-4xl font-semibold">{maxShift == null ? "–" : `${Math.round(maxShift * 100)} pts`}</div>
            <div className="text-sm text-ink/60">largest shift from any incentive vs no incentive</div>
            <p className="mt-3 text-xs text-ink/45">Measured on a case where the no-incentive baseline was already 100%. The borderline version (baseline nearer 50%) is the stronger test.</p>
          </div>
          <div className="card p-5">
            <div className="label">Under pressure</div>
            <div className="mt-2 num text-4xl font-semibold">{pct(social)}</div>
            <div className="text-sm text-ink/60">moved under social pressure</div>
            <div className="mt-1 text-sm text-ink/60">vs <b className="num">{pct(info)}</b> for real new information</div>
            <p className="mt-3 text-xs text-ink/70 bg-highlight/50 px-1">Smoke-test sample (n≤3 per arm). Illustrative only.</p>
          </div>
        </div>

        <section className="mt-12"><h2 className="serif text-[28px] tracking-[-0.01em]">Say vs Do by scenario</h2><div className="mt-4"><SayDoTable b={b} rows={sd} /></div></section>
        <section className="mt-12"><h2 className="serif text-[28px] tracking-[-0.01em]">Self-interest</h2><div className="mt-4 grid gap-4 md:grid-cols-2">{si.map((s) => <SelfInterestChart key={s.case} s={s} b={b} />)}</div></section>
        <section className="mt-12"><h2 className="serif text-[28px] tracking-[-0.01em]">Values under pressure</h2><div className="mt-4"><PressureChart rows={pr} b={b} /></div></section>
        <section className="mt-12"><h2 className="serif text-[28px] tracking-[-0.01em]">Baseline</h2><div className="mt-4"><BaselineTable rows={mine(b.baseline)} /></div></section>
        <section className="mt-12"><h2 className="serif text-[28px] tracking-[-0.01em]">Findings</h2><div className="mt-4 grid gap-4 md:grid-cols-3">{mine(b.findings).map((f) => <FindingCard key={f.id} f={f} modelName={modelName(b, f.model)} example={b.is_example} />)}</div></section>
      </div>
    </main>
  );
}
