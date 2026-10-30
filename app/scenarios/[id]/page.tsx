import Link from "next/link";
import { notFound } from "next/navigation";
import { ExampleBanner, ExampleTag } from "@/components/Banner";
import { HBar, Triptych } from "@/components/Bars";
import { SelfInterestChart } from "@/components/Sections";
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
      <div className="mx-auto max-w-6xl px-5 py-12">
        <div className="flex flex-wrap items-center gap-2 text-sm text-ink/50"><span className="chip">{s.foundation}</span><span>{s.id}</span></div>
        <h1 className="serif mt-2 text-[44px] tracking-[-0.02em]">{s.title}</h1>
        <p className="mt-2 text-ink/60">Tension: {s.value}</p>

        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <div className="card p-5"><div className="label text-say">Says: the principle it rates</div><p className="serif mt-1 text-lg leading-snug">&ldquo;{s.say_statement}&rdquo;</p><p className="mt-2 text-xs text-ink/45">7-point scale, strongly disagree to strongly agree.</p></div>
          <div className="card p-5"><div className="label text-prussian-2">Tells another agent: someone else&apos;s case</div><p className="text-sm leading-6 text-ink/75">{s.judge_vignette}</p>
            {s.judge_options && <ul className="mt-2 space-y-1 text-sm">{Object.entries(s.judge_options).map(([k, t]) => <li key={k}><code className="mr-1 text-xs text-ink/40">{k}</code>{t}</li>)}</ul>}</div>
        </div>
        <p className="mt-3 text-xs text-ink/50"><b className="text-do">Does:</b> the model is deployed as the agent with real tools (mock accounts, policies, a reply tool) and handles the same situation itself. The full agent prompt and tool transcript are in the donor trace view below.</p>

        {rows.map((r) => (
          <section key={r.model} className="mt-10">
            <div className="flex items-center gap-2"><h2 className="serif text-[28px] tracking-[-0.01em]">{modelName(b, r.model)}</h2>{r.sample_size_note && <ExampleTag>{r.sample_size_note}</ExampleTag>}</div>
            <div className="mt-4 grid gap-4 md:grid-cols-[1fr_1.2fr]">
              <div className="card p-5">
                <Triptych say={r.say.agree_rate == null ? null : r.say.agree_rate >= 0.5 ? r.say.agree_rate : 1 - r.say.agree_rate} judge={r.judge.consistent_rate} doo={r.do[0]?.consistent_rate ?? null}
                  option={s.judge_options?.[r.say_implied_option] || r.say_implied_option} n={r.do[0]?.n ?? r.judge.n}
                  sayLabel={`rated the principle ${r.say.mean} / 7`} judgeLabel="in someone else's case" doLabel={r.do[0] ? plainLabel(r.do[0].label) : undefined} />
              </div>
              <div className="card p-5">
                <div className="label">What it actually did as the agent, by version of the scenario</div>
                <p className="-mt-1 mb-1 font-sans text-[11px] text-ink/55">% of runs that chose the option its stated view implies</p>
                <div className="mt-3 space-y-3">{r.do.map((d) => <HBar key={d.variant} label={plainLabel(d.label)} value={d.consistent_rate} n={d.n} color="bg-do" sub={Object.entries(d.counts).map(([k, n]) => `${k} ${n}`).join(" · ")} />)}</div>
              </div>
            </div>
          </section>
        ))}

        {si.length > 0 && (
          <section className="mt-10"><h2 className="serif text-[28px] tracking-[-0.01em]">Self-interest versions</h2><div className="mt-4 grid gap-4 md:grid-cols-2">{si.map((x) => <SelfInterestChart key={x.case} s={x} b={b} />)}</div></section>
        )}

        <section className="mt-12" id="traces">
          <div className="flex items-center gap-2"><h2 className="serif text-[28px] tracking-[-0.01em]">Prompts &amp; reasoning traces</h2><span className="chip">Donors only</span></div>
          {!donor ? (
            <div className="card mt-4 flex flex-col items-start gap-3 bg-panel p-6 md:flex-row md:items-center">
              <div className="flex-1">
                <div className="font-semibold">Read exactly what the model was told, and how it reasoned.</div>
                <p className="mt-1 text-sm text-ink/60">Donors of any amount can read the exact prompts, tool calls, replies and reasoning summaries for every public item. Hold-out items stay private for everyone.</p>
              </div>
              <div className="flex gap-2">{user ? <Link href="/donate" className="btn-money">Donate to unlock</Link> : <><Link href={`/signin?next=/scenarios/${id}%23traces`} className="btn-ghost">Sign in</Link><Link href="/donate" className="btn-money">Donate</Link></>}</div>
            </div>
          ) : (
            <div className="mt-4">
              <div className="mb-3 flex flex-wrap gap-2">{variants.map((x) => <Link key={x} href={`/scenarios/${id}?v=${encodeURIComponent(x)}#traces`} className={`chip ${v === x ? "!bg-ink !text-white" : ""}`}>{x.replace(":", " · ")}</Link>)}</div>
              <p className="mb-3 text-xs text-ink/55">{tr!.is_example ? "Example traces from the runs" : "Up to 3 traces per run and condition, exported from the donor-only results files"}. Hold-out items are never included. Runs marked superseded were replaced by a fixed rerun and are shown for transparency only.</p>
              <div className="space-y-4">
                {tr!.traces.filter((t) => !v || `${t.module}:${t.variant}` === v).slice(0, 12).map((t, i) => (
                  <details key={i} className="card p-4" open={i === 0}>
                    <summary className="cursor-pointer text-sm font-semibold">{t.module.toUpperCase()} · {t.variant} · sample {t.sample} → <span className="num">{t.label ?? "–"}</span>{t.validity === "superseded" && <span className="ml-2"><ExampleTag>Superseded run</ExampleTag></span>}{t.run_id && <span className="ml-2 num text-[11px] font-normal text-ink/40">{t.run_id}</span>}</summary>
                    <div className="mt-3 grid gap-3 text-sm md:grid-cols-2">
                      <div>
                        {t.prompt.system && <><div className="label">System prompt</div><pre className="whitespace-pre-wrap bg-ink/[0.04] p-3 text-xs leading-5">{t.prompt.system}</pre></>}
                        <div className="label mt-2">User</div><pre className="whitespace-pre-wrap bg-ink/[0.04] p-3 text-xs leading-5">{t.prompt.user}</pre>
                        {t.prompt.tools && <div className="mt-2 text-xs text-ink/55">Tools available: <span className="num">{t.prompt.tools.join(", ")}</span></div>}
                      </div>
                      <div>
                        {t.reasoning && <><div className="label">Reasoning (summarized by the provider)</div><pre className="whitespace-pre-wrap bg-prussian/[0.06] p-3 text-xs leading-5">{t.reasoning}</pre></>}
                        {t.tool_calls && t.tool_calls.length > 0 && <><div className="label mt-2">Tool calls</div><pre className="whitespace-pre-wrap bg-vermilion/[0.06] p-3 text-xs leading-5">{t.tool_calls.map((c) => `${c.name}(${JSON.stringify(c.input)})`).join("\n")}</pre></>}
                        <div className="label mt-2">Answer</div><pre className="whitespace-pre-wrap bg-ink/[0.04] p-3 text-xs leading-5">{t.answer}</pre>
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
