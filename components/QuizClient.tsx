"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Eyebrow } from "./Brand";
import Share from "./Share";
import { QUIZ, match, twinParts, type Rates } from "@/lib/quizItems";
import { modelMeta, modelSlug } from "@/lib/v3meta";
import { WRAPPER, quizPost } from "@/lib/shareCopy";

const pct = (v: number | null | undefined) => (v == null ? "–" : `${Math.round(v * 100)}%`);
const KIND: Record<string, string> = { said: "What models answered", did: "What models did in a simulated job", pushback: "Whether models changed their answer" };
const KIND_SHORT: Record<string, string> = { said: "Said", did: "Did", pushback: "Changed answer" };

function Cells({ p, color }: { p: number; color: string }) {
  const filled = Math.round(p * 20);
  return <div className="grid grid-cols-[repeat(20,minmax(0,1fr))] gap-[3px]" aria-hidden>{Array.from({ length: 20 }, (_, j) => <span key={j} className={`aspect-[2/1] ${j < filled ? color : "border border-ink/15 bg-paper"}`} />)}</div>;
}

/** The whole quiz runs in this component. Answers live in React state only: no URL params, no requests, nothing stored. */
export default function QuizClient({ rates, taglines, previewTag, nModels, final = false }: { rates: Rates; taglines: Record<string, string>; previewTag: React.ReactNode; nModels: number; final?: boolean }) {
  const [step, setStep] = useState<"intro" | number | "result">("intro");
  const [answers, setAnswers] = useState<Record<string, "y" | "n">>({});
  const [inc, setInc] = useState(false);
  useEffect(() => { window.scrollTo({ top: 0 }); }, [step]);

  if (step === "intro") return (
    <>
      <section className="relative mx-auto max-w-[1200px] overflow-hidden border-b border-rule">
        <div aria-hidden className="pixel-grid absolute inset-0 [mask-image:linear-gradient(to_bottom,black,transparent_85%)]" />
        <div className="relative grid gap-10 px-5 pb-14 pt-12 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] md:px-8 md:pb-16 md:pt-16">
          <div>
            <Eyebrow>Try it yourself · {QUIZ.length} dilemmas · about 2 minutes</Eyebrow>
            <h1 className="wide mt-6 text-[40px] font-bold leading-[0.96] tracking-[-0.045em] md:text-[64px]">Which AI model are you most like?</h1>
            <p className="mt-6 max-w-xl text-[18px] leading-relaxed text-ink/70">Answer {QUIZ.length} short dilemmas. Each one is a situation we put to {nModels} AI models, many times over. Then find your AI ethical twin: the model whose choices come closest to yours.</p>
            <div className="mt-8 flex flex-wrap gap-3"><button type="button" onClick={() => { setAnswers({}); setStep(0); }} className="btn-primary"><span className="h-2 w-2 bg-vermilion" />Start</button><Link href="/learn" className="btn-ghost">What is this about?</Link></div>
            <p className="mt-5 text-[13.5px] leading-6 text-ink/55">There are no right answers, and we don&apos;t score you. Your answers stay in your browser: nothing is sent or stored.</p>
          </div>
          <div className="flex flex-col gap-3 self-end">
            <div className="label">Before you start</div>
            {[
              ["For fun, not a personality test", `${QUIZ.length} questions can't tell you who you are. It's a way into the questions, not a verdict on you or on any model.`],
              final ? ["Final data", "The model numbers come from the final, pre-registered v3 run. Each is a share of many runs, in simulated tasks."] : ["Preliminary data", "The model numbers come from our current results, which are preliminary. They can change when the final run is in."],
              ["Said vs did", "Some questions use what models answered when asked. Others use what models did when given a simulated job with real tools. Each question says which."],
              ["Open matching", "You'll see the exact numbers behind your match, question by question."],
            ].map(([t, b]) => <div key={t} className="border border-rule bg-paper p-4"><div className="text-[15px] font-semibold">{t}</div><p className="mt-1 text-[13.5px] leading-6 text-ink/60">{b}</p></div>)}
          </div>
        </div>
      </section>
      <section className="mx-auto max-w-[1200px] border-b border-rule p-5 md:p-8">
        <div className="label">What&apos;s in it</div>
        <ol className="mt-3 grid gap-x-8 gap-y-2 md:grid-cols-2">
          {QUIZ.map((q, i) => <li key={q.id} className="flex gap-3 text-[14.5px]"><span className="num font-mono text-[11px] text-ink/40">{String(i + 1).padStart(2, "0")}</span><span><b className="font-semibold">{q.title}.</b> <span className="text-ink/60">{KIND[q.kind]}</span></span></li>)}
        </ol>
      </section>
    </>
  );

  if (typeof step === "number") {
    const q = QUIZ[step];
    const pick = (a: "y" | "n") => { setAnswers((x) => ({ ...x, [q.id]: a })); setStep(step + 1 < QUIZ.length ? step + 1 : "result"); };
    return (
      <>
        <section className="relative mx-auto max-w-[1200px] overflow-hidden border-b border-rule">
          <div aria-hidden className="pixel-grid absolute inset-0 [mask-image:linear-gradient(to_bottom,black,transparent_85%)]" />
          <div className="relative px-5 pt-8 md:px-8">
            <div className="flex flex-wrap items-center justify-between gap-2"><Eyebrow>Question {step + 1} of {QUIZ.length} · {q.title}</Eyebrow><span className="font-mono text-[10.5px] uppercase tracking-[0.08em] text-ink/45">{KIND[q.kind]}</span></div>
            <div className="mt-4 grid gap-1" style={{ gridTemplateColumns: `repeat(${QUIZ.length}, minmax(0, 1fr))` }}>{QUIZ.map((_, j) => <span key={j} className={`h-1.5 ${j < step ? "bg-ink" : j === step ? "bg-vermilion" : "bg-ink/10"}`} />)}</div>
          </div>
          <div className="relative grid gap-10 px-5 pb-14 pt-10 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] md:px-8 md:pb-20 md:pt-14">
            <div>
              <h1 className="wide text-[36px] font-bold leading-[0.98] tracking-[-0.045em] md:text-[56px]">{q.q}</h1>
              <p className="mt-6 max-w-xl text-[18px] leading-relaxed text-ink/70">{q.body}</p>
            </div>
            <div className="flex flex-col justify-end gap-3">
              <div className="label">Your answer</div>
              {([["y", q.yes], ["n", q.no]] as const).map(([k, t]) => (
                <button key={k} type="button" onClick={() => pick(k)} className={`btn-ghost !justify-between !border-ink !py-5 !text-[14px] hover:!bg-ink hover:!text-white ${answers[q.id] === k ? "!bg-ink !text-white" : ""}`}>{t}<span>→</span></button>
              ))}
              <div className="mt-2 flex justify-between font-mono text-[11px] uppercase tracking-[0.06em] text-ink/50">
                <button type="button" onClick={() => setStep(step === 0 ? "intro" : step - 1)} className="uppercase hover:text-vermilion">← Back</button>
                <span>No right answer</span>
              </div>
            </div>
          </div>
        </section>
        <section className="mx-auto max-w-[1200px] border-b border-rule px-5 py-4 md:px-8"><p className="text-[12.5px] leading-6 text-ink/50">The model numbers for this question: {q.source}. You&apos;ll see them after the last question. Your answers stay in this browser tab.</p></section>
      </>
    );
  }

  const m = match(answers, rates);
  const top = m.models[0];
  const score = Math.round((top.score ?? 0) * 100);
  const [before, after] = twinParts();
  const post = quizPost(inc ? { model: top.name, score } : null);
  const sharePath = inc ? `/s/quiz?m=${modelSlug(top.id)}&s=${score}` : "/quiz";
  const order = Object.keys(rates);
  return (
    <>
      <section className="mx-auto max-w-[1200px] border-b border-rule">
        <div className="grid md:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)]">
          <div className="border-b border-rule p-5 md:border-b-0 md:border-r md:p-8">
            <Eyebrow>Your result · {QUIZ.length} of {QUIZ.length} answered</Eyebrow>
            <h1 className="mt-8">
              {before.trim() && <span className="label block">{before.trim()}</span>}
              <span className="wide block text-[38px] font-bold leading-[0.98] tracking-[-0.04em] md:text-[48px]">{top.name}{after.trim() ? ` ${after.trim()}` : ""}<span className="text-vermilion">.</span></span>
            </h1>
            {taglines[top.id] && <p className="mt-5 text-[17px] leading-relaxed text-ink">{taglines[top.id]}</p>}
            <p className="mt-4 text-[15px] leading-relaxed text-ink/65">Across the {top.items} questions it was tested on, <b className="num font-semibold text-ink">{pct(top.score)}</b> of {top.name}&apos;s runs made the same choice you did. 100% would mean it always chose like you.</p>
            <p className="mt-4 text-[13.5px] leading-6 text-ink/55">A resemblance, not a ranking: no model and no answer here is the right one. Just for fun, on {final ? "the final v3 results" : "preliminary data"}.</p>
            <div className="mt-6 flex flex-wrap gap-2"><button type="button" onClick={() => setStep(0)} className="btn-ghost">Change my answers</button><Link href="/learn" className="btn-ghost">Why this matters →</Link></div>
          </div>
          <div className="flex flex-col">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-rule px-5 py-4 md:px-8"><span className="kicker text-ink">How close you are to each</span>{previewTag}</div>
            {m.models.map((r, k) => (
              <div key={r.id} className={`grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 border-b border-rule p-5 md:grid-cols-[170px_minmax(0,1fr)_80px] md:gap-6 md:px-8 ${k === 0 ? "bg-panel" : ""}`}>
                <div className="text-[15px] leading-snug"><Link href={`/models/${r.slug}`} className="font-semibold hover:text-vermilion">{r.name}</Link>{r.items < QUIZ.length && <div className="font-mono text-[10px] uppercase tracking-[0.06em] text-ink/45">{r.items} of {QUIZ.length} questions tested</div>}</div>
                <div className="col-span-2 md:order-2 md:col-span-1"><Cells p={r.score ?? 0} color="bg-prussian" /></div>
                <div className="num text-right text-[26px] font-semibold md:order-3">{pct(r.score)}</div>
              </div>
            ))}
            <p className="px-5 py-3 font-mono text-[10.5px] leading-5 text-ink/50 md:px-8">Match: for each question, the share of a model&apos;s runs that chose what you chose, averaged over all the questions that model was tested on.</p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1200px] border-b border-rule p-5 md:p-8">
        <div className="label">Question by question · share of runs that chose what you chose</div>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-[13.5px]">
            <thead><tr className="border-b border-ink font-mono text-[10.5px] uppercase tracking-[0.06em] text-ink/55"><th className="py-2 pr-3">Question</th><th className="pr-3">Type</th><th className="pr-3">You</th>{order.map((id) => <th key={id} className="pr-3">{modelMeta(id).name}</th>)}<th className="pr-3">People (study)</th></tr></thead>
            <tbody>{QUIZ.map((q) => { const a = answers[q.id]; return (
              <tr key={q.id} className="border-b border-rule align-top">
                <td className="py-2 pr-3 font-semibold">{q.title}</td>
                <td className="pr-3 text-[12px] text-ink/55">{KIND_SHORT[q.kind]}</td>
                <td className="pr-3">{a ? (a === "y" ? q.yes : q.no) : "–"}</td>
                {order.map((id) => { const r = rates[id]?.[q.id]; return <td key={id} className="num pr-3">{r && a ? pct(a === "y" ? r.p : 1 - r.p) : "not tested"}</td>; })}
                <td className="num pr-3">{q.human && a ? pct(a === "y" ? q.human.value : 1 - q.human.value) : "–"}</td>
              </tr>); })}</tbody>
          </table>
        </div>
        <ul className="mt-4 space-y-1 text-[12.5px] leading-6 text-ink/50">
          <li><b className="font-semibold text-ink/70">People (study)</b>: published human answers, where they exist (Footbridge only). Shown for reference; they are not part of any match.</li>
          <li><b className="font-semibold text-ink/70">Said</b>: what models answered when asked the dilemma. <b className="font-semibold text-ink/70">Did</b>: what models did when given a simulated job with real tools. <b className="font-semibold text-ink/70">Changed answer</b>: whether they reversed after three turns of disagreement with no new argument.</li>
          {QUIZ.map((q) => <li key={q.id}>{q.title}: {q.source}.</li>)}
        </ul>
      </section>

      <section className="mx-auto grid max-w-[1200px] border-b border-rule md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="bg-ink p-6 text-white md:p-10">
          <div className="kicker text-vermilion">Share it</div>
          <p className="serif mt-4 text-[24px] leading-[1.2] md:text-[28px]">{WRAPPER}</p>
          <p className="mt-4 text-[14px] leading-6 text-white/60">Every share leads with this, so a post about your result is also an invitation to think about how AI makes choices.</p>
          <div aria-label="Share card preview" className="mt-6 border border-white/20 bg-paper p-4 text-ink">
            <div className="text-[15px] font-semibold leading-snug">{WRAPPER}</div>
            <div className="mt-3 border-l-4 border-ink bg-panel px-3 py-2">
              {inc ? <><div className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink/50">{before.trim() || "My AI ethical twin"}</div><div className="flex items-baseline justify-between gap-3"><span className="wide text-[20px] font-bold">{top.name}</span><span className="num text-[18px] font-semibold">{score}%</span></div></>
                : <div className="wide text-[18px] font-bold leading-tight">Which AI model are you most like?</div>}
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-5 p-6 md:p-10">
          <button type="button" role="switch" aria-checked={inc} onClick={() => setInc((x) => !x)} className="flex items-start gap-3 border border-rule p-4 text-left hover:bg-panel">
            <span className={`mt-0.5 inline-flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition-colors ${inc ? "justify-end bg-vermilion" : "justify-start bg-ink/20"}`}><span className="h-4 w-4 rounded-full bg-white" /></span>
            <span><span className="text-[15px] font-semibold">Include my result</span><span className="block text-[13px] leading-6 text-ink/55">{inc ? `Adds "${top.name}, ${score}% match" to the post and the card. Only that goes in the link, never your answers.` : "Off: the post invites people to take the quiz, with no result."}</span></span>
          </button>
          <div>
            <div className="label mb-2">Post preview</div>
            <div className="border border-rule bg-panel p-4 text-[14px] leading-6">{post.text}</div>
          </div>
          <Share label="Share" path={sharePath} text={post.text} subject={post.subject} emailBody={post.email} />
          <p className="text-[12.5px] leading-6 text-ink/50">{inc ? "The link carries only the model name and the percentage. We don't save it; the preview card is drawn from the link itself." : "Shares the quiz, not your answers."}</p>
        </div>
      </section>
    </>
  );
}
