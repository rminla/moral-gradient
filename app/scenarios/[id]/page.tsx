import Link from "next/link";
import { notFound } from "next/navigation";
import { ExampleBanner, ExampleTag } from "@/components/Banner";
import { HBar, Triptych } from "@/components/Bars";
import { SelfInterestChart } from "@/components/Sections";
import { PageHead, SectionHead } from "@/components/Brand";
import { HumanSlot } from "@/components/Human";
import { currentUser, isDonor } from "@/lib/auth";
import { getBundle, getTraces, modelName, plainLabel } from "@/lib/bundle";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const b = await getBundle();
  const __p = await params;
  const s = b.scenarios.find((x) => x.id === __p.id);
  return { title: s ? s.title : "Scenario" };
}

export default async function ScenarioPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ v?: string }> }) {
  const { id } = await params;
  const b = await getBundle();
  const s = b.scenarios.find((x) => x.id === id); // hold-out scenarios are already stripped -> 404
  if (!s) notFound();
  const user = await currentUser();
  const donor = await isDonor(user);
  const rows = b.saydo.filter((r) => r.scenario === id);
  const si = b.selfinterest.filter((r) => r.scenario === id);
  const tr = donor ? await getTraces(id) : null;
  const { v } = await searchParams;
  const variants = tr ? [...new Set(tr.traces.map((t) => `${t.module}:${t.variant}`))] : [];
  return (
    <main>
      <ExampleBanner example={b.is_example} exploratory={b.exploratory} />
      <PageHead eyebrow={<>Scenario · {s.foundation} · <span className="text-ink/45">{s.id}</span></>} title={s.title}>Tension: {s.value}</PageHead>

      <section className="mx-auto grid max-w-[1200px] border-b border-rule md:grid-cols-3 md:divide-x md:divide-rule">
        <div className="border-b border-rule p-5 md:border-b-0 md:p-8"><div className="kicker flex items-center gap-2 text-ink/55"><span className="h-2 w-2 bg-prussian-2" />01 · Says</div><p className="mt-4 text-[19px] font-medium leading-snug tracking-[-0.01em]">&ldquo;{s.say_statement}&rdquo;</p><p className="mt-3 font-mono text-[10.5px] text-ink/45">Rated on a 7-point scale, strongly disagree to strongly agree.</p></div>
        <div className="border-b border-rule p-5 md:border-b-0 md:p-8"><div className="kicker flex items-center gap-2 text-ink/55"><span className="h-2 w-2 bg-prussian" />02 · Tells another agent</div><p className="mt-4 text-[14px] leading-6 text-ink/75">{s.judge_vignette}</p>
          {s.judge_options && <ul className="mt-3 space-y-1.5 text-[14px]">{Object.entries(s.judge_options).map(([k, t]) => <li key={k} className="flex gap-2"><code className="mt-0.5 font-mono text-[11px] text-ink/40">{k}</code><span>{t}</span></li>)}</ul>}</div>
        <div className="bg-ink p-5 text-white md:p-8"><div className="kicker flex items-center gap-2 text-white/55"><span className="h-2 w-2 bg-vermilion" />03 · Does</div><p className="mt-4 text-[15px] leading-6 text-white/80">The model is deployed as the agent with real tools (mock accounts, policies, a reply tool) and handles the same situation itself.</p><p className="mt-3 font-mono text-[10.5px] text-white/45">Full agent prompt and tool transcript: donor trace view below.</p></div>
      </section>

      <div className="mx-auto max-w-[1200px] px-5 pb-16 md:px-8">

        {rows.map((r) => (
          <section key={r.model} className="border-b border-rule py-12">
            <div className="flex items-center gap-2"><h2 className="wide text-[26px] font-bold tracking-[-0.035em] md:text-[32px]">{modelName(b, r.model)}</h2>{r.sample_size_note && <ExampleTag>{r.sample_size_note}</ExampleTag>}</div>
            <div className="mt-5 grid gap-3 md:grid-cols-[1fr_1.2fr]">
              <div className="ticks border border-rule p-5">
                <Triptych say={r.say.agree_rate == null ? null : r.say.agree_rate >= 0.5 ? r.say.agree_rate : 1 - r.say.agree_rate} judge={r.judge.consistent_rate} doo={r.do[0]?.consistent_rate ?? null}
                  option={s.judge_options?.[r.say_implied_option] || r.say_implied_option} n={r.do[0]?.n ?? r.judge.n}
                  sayLabel={`rated the principle ${r.say.mean} / 7`} judgeLabel="in someone else's case" doLabel={r.do[0] ? plainLabel(r.do[0].label) : undefined} />
                <HumanSlot compact className="mt-4 border-t border-dashed border-rule pt-3" />
              </div>
              <div className="ticks border border-rule p-5">
                <div className="label">What it actually did as the agent, by version of the scenario</div>
                <p className="-mt-1 mb-1 font-sans text-[11px] text-ink/55">% of runs that chose the option its stated view implies</p>
                <div className="mt-3 space-y-3">{r.do.map((d) => <HBar key={d.variant} label={plainLabel(d.label)} value={d.consistent_rate} n={d.n} color="bg-do" sub={Object.entries(d.counts).map(([k, n]) => `${k} ${n}`).join(" · ")} />)}</div>
              </div>
            </div>
          </section>
        ))}

        {si.length > 0 && (
          <section className="border-b border-rule py-12"><SectionHead kicker="Self-interest" title="Self-interest versions." /><div className="mt-8 grid gap-3 md:grid-cols-2">{si.map((x) => <SelfInterestChart key={x.case} s={x} b={b} />)}</div></section>
        )}

        <section className="scroll-mt-20 py-12" id="traces">
          <div className="flex flex-wrap items-end gap-3"><SectionHead kicker="Donors only" title="Prompts & reasoning traces." /></div>
          {!donor ? (
            <div className="hatch mt-8 flex flex-col items-start gap-4 border border-rule p-6 md:flex-row md:items-center">
              <div className="flex-1">
                <div className="text-[17px] font-semibold">Read exactly what the model was told, and how it reasoned.</div>
                <p className="mt-1 text-sm text-ink/60">Donors of any amount can read the exact prompts, tool calls, replies and reasoning summaries for every public item. Hold-out items stay private for everyone.</p>
              </div>
              <div className="flex gap-2">{user ? <Link href="/donate" className="btn-money">Donate to unlock</Link> : <><Link href={`/signin?next=/scenarios/${id}%23traces`} className="btn-ghost">Sign in</Link><Link href="/donate" className="btn-money">Donate</Link></>}</div>
            </div>
          ) : (
            <div className="mt-8">
              <div className="mb-3 flex flex-wrap gap-2">{variants.map((x) => <Link key={x} href={`/scenarios/${id}?v=${encodeURIComponent(x)}#traces`} className={`chip ${v === x ? "!bg-ink !text-white" : ""}`}>{x.replace(":", " · ")}</Link>)}</div>
              <p className="mb-3 text-xs text-ink/55">{tr!.is_example ? "Example traces from the runs" : "Up to 3 traces per run and condition, exported from the donor-only results files"}. Hold-out items are never included. Runs marked superseded were replaced by a fixed rerun and are shown for transparency only.</p>
              <div className="space-y-3">
                {tr!.traces.filter((t) => !v || `${t.module}:${t.variant}` === v).slice(0, 12).map((t, i) => (
                  <details key={i} className="border border-rule p-4" open={i === 0}>
                    <summary className="cursor-pointer text-sm font-semibold">{t.module.toUpperCase()} · {t.variant} · sample {t.sample} → <span className="num">{t.label ?? "–"}</span>{t.validity === "superseded" && <span className="ml-2"><ExampleTag>Superseded run</ExampleTag></span>}{t.run_id && <span className="ml-2 num text-[11px] font-normal text-ink/40">{t.run_id}</span>}</summary>
                    <div className="mt-3 grid gap-3 text-sm md:grid-cols-2">
                      <div>
                        {t.prompt.system && <><div className="label">System prompt</div><pre className="whitespace-pre-wrap bg-panel p-3 text-xs leading-5">{t.prompt.system}</pre></>}
                        <div className="label mt-2">User</div><pre className="whitespace-pre-wrap bg-panel p-3 text-xs leading-5">{t.prompt.user}</pre>
                        {t.prompt.tools && <div className="mt-2 text-xs text-ink/55">Tools available: <span className="num">{t.prompt.tools.join(", ")}</span></div>}
                      </div>
                      <div>
                        {t.reasoning && <><div className="label">Reasoning (summarized by the provider)</div><pre className="whitespace-pre-wrap bg-panel p-3 text-xs leading-5">{t.reasoning}</pre></>}
                        {t.tool_calls && t.tool_calls.length > 0 && <><div className="label mt-2">Tool calls</div><pre className="whitespace-pre-wrap bg-highlight/40 p-3 text-xs leading-5">{t.tool_calls.map((c) => `${c.name}(${JSON.stringify(c.input)})`).join("\n")}</pre></>}
                        <div className="label mt-2">Answer</div><pre className="whitespace-pre-wrap bg-panel p-3 text-xs leading-5">{t.answer}</pre>
                      </div>
                    </div>
                  </details>
                ))}
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
