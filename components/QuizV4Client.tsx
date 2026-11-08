"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Eyebrow } from "./Brand";
import Share from "./Share";
import { FOUNDATIONS, QUIZ_V4, type Foundation, type QuizV4Item } from "@/lib/quizV4Items";
import { V4_PLACEHOLDER, PLACEHOLDER_META } from "@/lib/quizV4Placeholder";
import { modelMeta } from "@/lib/v3meta";
import { WRAPPER } from "@/lib/shareCopy";

type Profile = Record<Foundation, number>;
const N = QUIZ_V4.length;

/** Foundation profile 0-100. Input per item: 0-100 toward the right option (visitor: 0 or 100; model: share of samples x 100). */
function profile(vals: Record<string, number>): Profile {
  const out = {} as Profile;
  for (const f of FOUNDATIONS) {
    let s = 0, w = 0;
    for (const it of QUIZ_V4) {
      const wt = it.weights[f.id];
      if (!wt || vals[it.id] == null) continue;
      s += Math.abs(wt) * (wt > 0 ? vals[it.id] : 100 - vals[it.id]);
      w += Math.abs(wt);
    }
    out[f.id] = w ? s / w : 50;
  }
  return out;
}
const dist = (a: Profile, b: Profile) => FOUNDATIONS.reduce((s, f) => s + Math.abs(a[f.id] - b[f.id]), 0) / FOUNDATIONS.length;
const topF = (p: Profile) => FOUNDATIONS.reduce((best, f) => (p[f.id] > p[best.id] ? f : best), FOUNDATIONS[0]);
const sayRate = (id: string, it: string) => { const d = V4_PLACEHOLDER[id][it].say; return d.k / d.n; };
const modelSide = (r: number) => (r > 0.5 ? 1 : r < 0.5 ? 0 : null);

type Hook = { it: QuizV4Item; kind: "gap" | "flip" | "walk"; u: 0 | 1; sk: number; sn: number; k: number; n: number; ak: number; an: number; gap: number };
function hooks(answers: Record<string, 0 | 1>, modelId: string): Hook[] {
  const data = V4_PLACEHOLDER[modelId];
  const hs: Hook[] = [];
  for (const it of QUIZ_V4) {
    const d = data[it.id];
    if (!it.do || !d?.do || !d.axis) continue;
    const u = answers[it.id];
    if (u == null || modelSide(d.say.k / d.say.n) !== u) continue;
    const gap = Math.abs(d.say.k / d.say.n - d.do.k / d.do.n);
    const flip = d.axis.k / d.axis.n;
    const kind = gap >= 0.25 ? "gap" : flip >= 0.3 ? "flip" : "walk";
    hs.push({ it, kind, u, sk: u ? d.say.k : d.say.n - d.say.k, sn: d.say.n, k: d.do.k, n: d.do.n, ak: d.axis.k, an: d.axis.n, gap });
  }
  const rank = { gap: 0, flip: 1, walk: 2 } as const;
  return hs.sort((a, b) => rank[a.kind] - rank[b.kind] || b.gap - a.gap);
}
const KIND_LABEL = { gap: "Said one thing, did another", flip: "Folded under pushback", walk: "Walked the talk" } as const;

export function PlaceholderBanner() {
  return (
    <div role="status" className="sticky top-0 z-40 border-b border-vermilion-dark bg-vermilion px-5 py-2 text-center font-mono text-[11.5px] font-medium uppercase tracking-[0.08em] text-white">
      Prototype: model numbers are placeholders · not real results · nothing you answer is stored
    </div>
  );
}

function Track({ marks }: { marks: { v: number; cls: string; label: string }[] }) {
  return (
    <div className="relative h-5">
      <div className="absolute inset-x-0 top-1/2 h-px bg-ink/20" />
      {[0, 50, 100].map((t) => <span key={t} className="absolute top-1/2 h-2 w-px -translate-y-1/2 bg-ink/25" style={{ left: `${t}%` }} />)}
      {marks.map((m) => <span key={m.label} title={`${m.label}: ${Math.round(m.v)}`} className={`absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 ${m.cls}`} style={{ left: `${m.v}%` }} />)}
    </div>
  );
}

export default function QuizV4Client() {
  const [step, setStep] = useState<"intro" | number | "result">("intro");
  const [answers, setAnswers] = useState<Record<string, 0 | 1>>({});
  const [askStay, setAskStay] = useState(false);
  useEffect(() => { setAskStay(Math.random() < 0.5); }, []);
  useEffect(() => { window.scrollTo({ top: 0 }); }, [step]);

  const go = (s: "intro" | number | "result") => setStep(s);

  const result = useMemo(() => {
    if (step !== "result") return null;
    const you = profile(Object.fromEntries(Object.entries(answers).map(([k, v]) => [k, v * 100])));
    const models = Object.keys(V4_PLACEHOLDER).map((id) => {
      const vals = Object.fromEntries(Object.entries(V4_PLACEHOLDER[id]).map(([k, v]) => [k, (v.say.k / v.say.n) * 100]));
      const p = profile(vals);
      return { id, name: modelMeta(id).name, p, d: dist(you, p) };
    }).sort((a, b) => a.d - b.d);
    return { you, models };
  }, [step, answers]);

  if (step === "intro") return (
    <>
      <section className="relative mx-auto max-w-[1200px] overflow-hidden border-b border-rule">
        <div aria-hidden className="pixel-grid absolute inset-0 [mask-image:linear-gradient(to_bottom,black,transparent_85%)]" />
        <div className="relative grid gap-10 px-5 pb-14 pt-12 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] md:px-8 md:pb-16 md:pt-16">
          <div>
            <Eyebrow>Quiz v4 prototype · {N} dilemmas · about 3 minutes</Eyebrow>
            <h1 className="wide mt-6 text-[40px] font-bold leading-[0.96] tracking-[-0.045em] md:text-[64px]">Who&apos;s your AI ethical twin?</h1>
            <p className="mt-6 max-w-xl text-[18px] leading-relaxed text-ink/70">{N} everyday dilemmas. Pick what you'd do. Then meet the AI model whose answers are closest to yours, and see what it actually <b className="text-vermilion">did</b> when we gave it the same job.</p>
            <div className="mt-8 flex flex-wrap gap-3"><button type="button" onClick={() => { setAnswers({}); go(0); }} className="btn-primary"><span className="h-2 w-2 bg-vermilion" />Start</button></div>
            <p className="mt-5 text-[13.5px] leading-6 text-ink/55">No right answers. Your answers stay in this browser tab: nothing is sent or stored.</p>
          </div>
          <div className="flex flex-col gap-3 self-end">
            <div className="label">Before you start</div>
            {[
              ["Say and do", "Each model answered every question about 20 times; we count how often it picked each option. For 11 of 12 we also gave them the job itself, with real-looking tools, in a sandbox."],
              ["Seven foundations", "Your twin is matched on your whole profile: care, equality, proportionality, loyalty, authority, purity and liberty."],
              ["Prototype", "The model numbers on this page are PLACEHOLDERS. No v4 runs exist yet."],
            ].map(([t, b]) => <div key={t} className="border border-rule bg-paper p-4"><div className="text-[15px] font-semibold">{t}</div><p className="mt-1 text-[13.5px] leading-6 text-ink/60">{b}</p></div>)}
          </div>
        </div>
      </section>
    </>
  );

  if (typeof step === "number") {
    const q = QUIZ_V4[step];
    const question = q.id === "game-night" ? (askStay ? "Should you stay home?" : "Should you go?") : q.question;
    const pick = (v: 0 | 1) => { setAnswers((x) => ({ ...x, [q.id]: v })); setStep(step + 1 < N ? step + 1 : "result"); };
    return (
      <section className="relative mx-auto max-w-[1200px] overflow-hidden border-b border-rule">
        <div aria-hidden className="pixel-grid absolute inset-0 [mask-image:linear-gradient(to_bottom,black,transparent_85%)]" />
        <div className="relative px-5 pt-8 md:px-8">
          <div className="flex flex-wrap items-center justify-between gap-2"><Eyebrow>Question {step + 1} of {N} · {q.title}</Eyebrow><span className="font-mono text-[10.5px] uppercase tracking-[0.08em] text-ink/45">{q.tag}{q.do ? " · say + do" : " · say only"}</span></div>
          <div className="mt-4 grid gap-1" style={{ gridTemplateColumns: `repeat(${N}, minmax(0, 1fr))` }}>{QUIZ_V4.map((_, j) => <span key={j} className={`h-1.5 ${j < step ? "bg-ink" : j === step ? "bg-vermilion" : "bg-ink/10"}`} />)}</div>
        </div>
        <div className="relative grid gap-10 px-5 pb-14 pt-10 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] md:px-8 md:pb-20 md:pt-14">
          <div>
            <p className="max-w-xl text-[18px] leading-relaxed text-ink/75">{q.scenario}</p>
            <h1 className="wide mt-6 text-[32px] font-bold leading-[1] tracking-[-0.04em] md:text-[46px]">{question}</h1>
          </div>
          <div className="flex flex-col justify-end gap-4">
            <div className="label">What should happen?</div>
            {([[0, q.left], [1, q.right]] as const).map(([v, t]) => (
              <button key={v} type="button" onClick={() => pick(v)} className={`btn-ghost !justify-between !border-ink !py-5 !text-left !text-[14px] hover:!bg-ink hover:!text-white ${answers[q.id] === v ? "!bg-ink !text-white" : ""}`}>{t}<span>→</span></button>
            ))}
            <div className="flex justify-between font-mono text-[11px] uppercase tracking-[0.06em] text-ink/50">
              <button type="button" onClick={() => go(step === 0 ? "intro" : step - 1)} className="uppercase hover:text-vermilion">← Back</button>
              <span>No right answer</span>
            </div>
          </div>
        </div>
      </section>
    );
  }

  const { you, models } = result!;
  const twin = models[0];
  const runner = models[1];
  const near = runner && runner.d - twin.d < 3;
  const yt = topF(you), tt = topF(twin.p);
  const diff = FOUNDATIONS.reduce((b, f) => (Math.abs(you[f.id] - twin.p[f.id]) > Math.abs(you[b.id] - twin.p[b.id]) ? f : b), FOUNDATIONS[0]);
  const hs = hooks(answers, twin.id);
  const match = Math.round(100 - twin.d);
  const shareText = `${WRAPPER} I took the Moral Gradient quiz v4 prototype (placeholder model numbers): my AI ethical twin came out as ${twin.name}. Who's yours?`;
  const label = (it: QuizV4Item, v: 0 | 1) => (v ? it.right : it.left);
  const allRate = (it: string, v: 0 | 1) => { const ids = Object.keys(V4_PLACEHOLDER); const r = ids.reduce((s, id) => s + sayRate(id, it), 0) / ids.length; return Math.round((v ? r : 1 - r) * 100); };

  return (
    <>
      <section className="mx-auto max-w-[1200px] border-b border-rule">
        <div className="grid md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
          <div className="border-b border-rule p-5 md:border-b-0 md:border-r md:p-8">
            <Eyebrow>Your result · {N} of {N} answered</Eyebrow>
            <h1 className="mt-8"><span className="label block">Your AI ethical twin is</span><span className="wide block text-[38px] font-bold leading-[0.98] tracking-[-0.04em] md:text-[48px]">{twin.name}<span className="text-vermilion">.</span></span></h1>
            <p className="mt-4 inline-block border border-vermilion px-2 py-0.5 font-mono text-[10.5px] uppercase tracking-[0.08em] text-vermilion">Placeholder data</p>
            <p className="mt-4 text-[15px] leading-relaxed text-ink/70">Across all seven foundations you&apos;re <b className="num text-ink">{match}%</b> alike: the average gap between your choices and its choice rates is {twin.d.toFixed(1)} points of 100.{near && <> A near tie with <b className="text-ink">{runner.name}</b> ({Math.round(100 - runner.d)}%).</>}</p>
            <div className="mt-6 grid gap-3">
              <div className="border border-rule p-4"><div className="label">What you share</div><p className="text-[15px] leading-6">{yt.id === tt.id ? <>You both put <b>{yt.name}</b> first ({Math.round(you[yt.id])} vs {Math.round(twin.p[tt.id])}).</> : <>You put <b>{yt.name}</b> first ({Math.round(you[yt.id])}); {twin.name} puts <b>{tt.name}</b> first ({Math.round(twin.p[tt.id])}).</>}</p></div>
              <div className="border border-rule p-4"><div className="label">Your biggest difference</div><p className="text-[15px] leading-6"><b>{diff.name}</b>: you {Math.round(you[diff.id])}, {twin.name} {Math.round(twin.p[diff.id])}. You care {you[diff.id] > twin.p[diff.id] ? "more" : "less"} about it.</p></div>
            </div>
            <div className="mt-6 flex flex-wrap gap-2"><button type="button" onClick={() => go(0)} className="btn-ghost">Change my answers</button><button type="button" onClick={() => { setAnswers({}); go("intro"); }} className="btn-ghost">Start over</button></div>
          </div>
          <div className="flex flex-col">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-rule px-5 py-4 md:px-8"><span className="kicker text-ink">Your profile vs {twin.name}</span><span className="flex items-center gap-3 font-mono text-[10.5px] uppercase tracking-[0.06em] text-ink/55"><span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 bg-ink" />You</span><span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-vermilion" />{twin.name}</span></span></div>
            {FOUNDATIONS.map((f) => (
              <div key={f.id} className={`grid grid-cols-[110px_minmax(0,1fr)_64px] items-center gap-4 border-b border-rule px-5 py-3 md:px-8 ${f.id === diff.id ? "bg-highlight/40" : ""}`}>
                <span className="text-[14px] font-semibold">{f.name}</span>
                <Track marks={[{ v: you[f.id], cls: "bg-ink", label: "You" }, { v: twin.p[f.id], cls: "rounded-full bg-vermilion", label: twin.name }]} />
                <span className="num text-right text-[12px] text-ink/60">{Math.round(you[f.id])} · {Math.round(twin.p[f.id])}</span>
              </div>
            ))}
            <div className="border-b border-rule px-5 py-4 md:px-8">
              <div className="label">How close you are to each model</div>
              {models.map((m, k) => <div key={m.id} className={`flex justify-between py-1 text-[14px] ${k === 0 ? "font-semibold" : "text-ink/70"}`}><span>{m.name}</span><span className="num">{Math.round(100 - m.d)}%</span></div>)}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1200px] border-b border-rule p-5 md:p-8">
        <div className="flex flex-wrap items-center justify-between gap-2"><span className="kicker text-ink">You said it. Here&apos;s what {twin.name} did.</span><span className="font-mono text-[10.5px] uppercase tracking-[0.06em] text-vermilion">Placeholder numbers</span></div>
        {hs.length === 0 && <p className="mt-4 text-[15px] text-ink/65">You and {twin.name} chose differently on every say-and-do question. Twins can disagree.</p>}
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          {hs.slice(0, 3).map((h, i) => (
            <article key={h.it.id} className={`border p-5 ${i === 0 ? "border-ink md:col-span-3" : "border-rule"}`}>
              <div className="flex flex-wrap items-center justify-between gap-2"><span className="label !mb-0">{h.it.title} · {h.it.tag}</span><span className={`font-mono text-[10.5px] uppercase tracking-[0.06em] ${h.kind === "walk" ? "text-moss" : "text-vermilion"}`}>{KIND_LABEL[h.kind]}</span></div>
              <p className={`mt-3 leading-snug ${i === 0 ? "text-[22px] font-semibold md:text-[26px]" : "text-[16px] font-semibold"}`}>You and {twin.name} both chose &ldquo;{label(h.it, h.u)}&rdquo; ({twin.name}: {h.sk} of {h.sn} samples).</p>
              <p className="mt-2 text-[15px] leading-6 text-ink/75">When {twin.name} was the {h.it.do!.role}, it <b className="text-vermilion">{h.it.do!.rightAction}</b> in <span className="num">{h.k} of {h.n}</span> runs ({Math.round((h.k / h.n) * 100)}%).</p>
              <p className="mt-2 text-[13.5px] leading-6 text-ink/60">{h.it.do!.axis}: it changed course in <span className="num">{h.ak} of {h.an}</span> runs.</p>
              <p className="mt-2 text-[12.5px] leading-5 text-ink/45">Moral Gradient visitors: not collected in this prototype. · {modelMeta(twin.id).name}, run date: {PLACEHOLDER_META.runDate}. {PLACEHOLDER_META.note}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-[1200px] border-b border-rule p-5 md:p-8">
        <div className="label">Every question</div>
        <div className="overflow-x-auto">
          <table className="mt-2 w-full min-w-[640px] text-left text-[13.5px]">
            <thead className="font-mono text-[10.5px] uppercase tracking-[0.06em] text-ink/50"><tr><th className="py-2 pr-3">Question</th><th className="pr-3">You chose</th><th className="pr-3">{twin.name} said the same</th><th className="pr-3">All models said the same</th><th className="pr-3">{twin.name} did</th><th>Published humans</th></tr></thead>
            <tbody>
              {QUIZ_V4.map((it) => { const d = V4_PLACEHOLDER[twin.id][it.id]; return (
                <tr key={it.id} className="border-t border-rule align-top">
                  <td className="py-2 pr-3"><b className="font-semibold">{it.title}</b><div className="text-[12px] text-ink/50">{it.left} / {it.right}</div></td>
                  <td className="pr-3">{label(it, answers[it.id])}</td>
                  <td className="num pr-3">{Math.round((answers[it.id] ? d.say.k / d.say.n : 1 - d.say.k / d.say.n) * 100)}%</td>
                  <td className="num pr-3">{allRate(it.id, answers[it.id])}% of runs</td>
                  <td className="num pr-3">{d.do ? `${d.do.k}/${d.do.n} ${it.do!.rightAction}` : "say only"}</td>
                  <td className="text-[12px] leading-5 text-ink/60">{it.published ?? "–"}</td>
                </tr>); })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mx-auto max-w-[1200px] border-b border-rule p-5 md:p-8">
        <div className="grid gap-6 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] md:items-end">
          <div><div className="kicker text-ink">Help more people see how AI makes moral choices</div><p className="mt-2 max-w-xl text-[15px] leading-6 text-ink/65">Share the quiz, not your answers: the link carries nothing about what you picked. In the prototype the twin is computed from placeholder numbers.</p></div>
          <Share path="/quiz-v4" text={shareText} subject="Who's your AI ethical twin? (prototype)" emailBody={`${shareText}\n\nIt's a prototype of the next Moral Gradient quiz; the model numbers are placeholders until the v4 runs are in.`} label="Share" />
        </div>
        <p className="mt-6 text-[12.5px] text-ink/45">Prototype on branch quiz-v4. Not linked from the site. <Link href="/quiz" className="link">Current quiz →</Link></p>
      </section>
    </>
  );
}
