"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Eyebrow } from "./Brand";
import { QUIZ_V4_NEW, type QuizV4ItemNew } from "@/lib/quizV4ItemsNew";

const N = QUIZ_V4_NEW.length;

// DEMO PLACEHOLDER DATA, NOT REAL MODEL RESULTS
// Fictional example scores for mockup purposes only
const DEMO_MODEL_ANSWERS: Record<string, Record<string, 0 | 1>> = {
  "claude-sonnet": {
    trolley: 1, "experience-machine": 0, veil: 0, omelas: 1, pig: 0, ring: 0,
    paintings: 1, "ceo-daughter": 0, cancellation: 0, shoes: 1
  },
  "gpt-4o": {
    trolley: 1, "experience-machine": 0, veil: 0, omelas: 1, pig: 1, ring: 0,
    paintings: 1, "ceo-daughter": 0, cancellation: 0, shoes: 0
  },
  "gemini-pro": {
    trolley: 1, "experience-machine": 0, veil: 1, omelas: 0, pig: 0, ring: 0,
    paintings: 0, "ceo-daughter": 0, cancellation: 0, shoes: 1
  },
};

function choiceAgreement(yours: Record<string, 0 | 1>, theirs: Record<string, 0 | 1>): number {
  let matches = 0;
  let total = 0;
  for (const id of Object.keys(yours)) {
    if (theirs[id] != null) {
      if (yours[id] === theirs[id]) matches++;
      total++;
    }
  }
  return total > 0 ? Math.round((matches / total) * 100) : 0;
}

export function PlaceholderBanner() {
  return (
    <div role="status" className="sticky top-0 z-40 border-b border-vermilion-dark bg-vermilion px-5 py-2 text-center font-mono text-[11.5px] font-medium uppercase tracking-[0.08em] text-white">
      Interactive mockup · fictional model data · nothing stored
    </div>
  );
}

export default function QuizV4ClientNew() {
  const [step, setStep] = useState<"intro" | number | "result">("intro");
  const [answers, setAnswers] = useState<Record<string, 0 | 1>>({});

  useEffect(() => { window.scrollTo({ top: 0, behavior: "smooth" }); }, [step]);

  const answerQuestion = (itemIdx: number, choice: 0 | 1) => {
    const item = QUIZ_V4_NEW[itemIdx];
    setAnswers(prev => ({ ...prev, [item.id]: choice }));
    const nextIdx = itemIdx + 1;
    if (nextIdx < N) {
      setStep(nextIdx);
    } else {
      setStep("result");
    }
  };

  if (step === "intro") return (
    <>
      <section className="relative mx-auto max-w-[1200px] overflow-hidden border-b border-rule">
        <div aria-hidden className="pixel-grid absolute inset-0 [mask-image:linear-gradient(to_bottom,black,transparent_85%)]" />
        <div className="relative grid gap-10 px-5 pb-14 pt-12 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] md:px-8 md:pb-16 md:pt-16">
          <div>
            <Eyebrow>Interactive mockup · {N} ethical dilemmas · about 5 minutes</Eyebrow>
            <h1 className="wide mt-6 text-[40px] font-bold leading-[0.96] tracking-[-0.045em] md:text-[64px]">Who's your AI ethical twin?</h1>
            <p className="mt-6 max-w-xl text-[18px] leading-relaxed text-ink/70">{N} ethical dilemmas, some famous and some everyday. Pick what you'd do. Then meet the model whose answers are closest to yours.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <button type="button" onClick={() => { setAnswers({}); setStep(0); }} className="btn-primary"><span className="h-2 w-2 bg-vermilion" />Start</button>
            </div>
            <p className="mt-5 text-[13.5px] leading-6 text-ink/55">No right answers. This is a mockup with fictional model data. Nothing you answer is stored.</p>
          </div>
          <div className="flex flex-col gap-3 self-end">
            <div className="label">What to expect</div>
            {[
              ["6 classic problems", "Famous ethical thought experiments from philosophy: the trolley problem, Nozick's experience machine, Rawls's veil of ignorance, and more."],
              ["4 everyday dilemmas", "Original scenarios about honesty, loyalty, fairness, and generosity in situations you might actually face."],
              ["Background and context", "Each question shows where it came from and why it matters for AI before you answer."],
              ["Demo data only", "The model results you'll see are fictional examples for this mockup, not real evaluations."],
            ].map(([t, b]) => <div key={t} className="border border-rule bg-paper p-4"><div className="text-[15px] font-semibold">{t}</div><p className="mt-1 text-[13.5px] leading-6 text-ink/60">{b}</p></div>)}
          </div>
        </div>
      </section>
    </>
  );

  if (typeof step === "number") {
    const item = QUIZ_V4_NEW[step];
    const answered = Object.keys(answers).length;
    return (
      <section className="relative mx-auto max-w-[1100px] overflow-hidden border-b border-rule">
        <div className="relative px-5 pt-8 md:px-8">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Eyebrow>Question {step + 1} of {N} · {item.title}</Eyebrow>
            <span className="font-mono text-[10.5px] uppercase tracking-[0.08em] text-ink/45">{item.category === "classic" ? "Classic problem" : "Everyday dilemma"}</span>
          </div>
          <div className="mt-4 grid gap-1" style={{ gridTemplateColumns: `repeat(${N}, minmax(0, 1fr))` }}>
            {QUIZ_V4_NEW.map((_, j) => <span key={j} className={`h-1.5 ${j < step ? "bg-ink" : j === step ? "bg-vermilion" : "bg-ink/10"}`} />)}
          </div>
        </div>
        <div className="relative px-5 pb-14 pt-10 md:px-8 md:pb-20 md:pt-14">
          <div className="mx-auto max-w-2xl">
            {/* Scenario */}
            <div className="space-y-4">
              {item.scenario.split('\n\n').map((para, i) => (
                <p key={i} className="text-[17px] leading-relaxed text-ink/75">{para}</p>
              ))}
            </div>

            {/* Question */}
            <h2 className="wide mt-8 text-[28px] font-bold leading-tight tracking-[-0.03em] md:text-[36px]">{item.question}</h2>

            {/* Background */}
            <div className="mt-8 border-l-4 border-ink/20 pl-5">
              <div className="label !mb-1.5">Background</div>
              <p className="text-[15px] leading-relaxed text-ink/75">{item.background}</p>
              {item.sourceUrl && (
                <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer" className="link mt-2 inline-block text-[14px]">
                  Learn more
                </a>
              )}
            </div>

            {/* AI Relevance */}
            <div className="mt-6 border-l-4 border-vermilion/30 pl-5">
              <div className="label !mb-1.5">Why it matters for AI</div>
              <p className="text-[15px] leading-relaxed text-ink/75">{item.aiRelevance}</p>
            </div>

            {/* Choices */}
            <div className="mt-10 space-y-3">
              {([[0, item.left], [1, item.right]] as const).map(([v, t]) => (
                <button 
                  key={v} 
                  type="button" 
                  onClick={() => answerQuestion(step, v)} 
                  className="btn-ghost !w-full !justify-start !border-ink !py-5 !text-left !text-[15px] hover:!bg-ink hover:!text-white"
                >
                  {t}
                </button>
              ))}
            </div>

            {/* Navigation */}
            {answered > 0 && (
              <div className="mt-6 flex justify-between font-mono text-[11px] uppercase tracking-[0.06em] text-ink/50">
                <button type="button" onClick={() => setStep(step - 1)} className="uppercase hover:text-vermilion">Back</button>
                <span>{answered} of {N} answered</span>
              </div>
            )}
          </div>
        </div>
      </section>
    );
  }

  if (step === "result") {
    const models = Object.entries(DEMO_MODEL_ANSWERS).map(([id, ans]) => ({
      id,
      name: id.split("-").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" "),
      agreement: choiceAgreement(answers, ans),
    })).sort((a, b) => b.agreement - a.agreement);

    const twin = models[0];
    const agreements = QUIZ_V4_NEW.map(item => ({
      item,
      yours: answers[item.id],
      theirs: DEMO_MODEL_ANSWERS[twin.id][item.id],
      match: answers[item.id] === DEMO_MODEL_ANSWERS[twin.id][item.id]
    }));

    return (
      <>
        <section className="mx-auto max-w-[1200px] border-b border-rule">
          <div className="grid md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
            <div className="border-b border-rule p-5 md:border-b-0 md:border-r md:p-8">
              <Eyebrow>Your result · {N} of {N} answered</Eyebrow>
              <h1 className="mt-8">
                <span className="label block">Your AI ethical twin is</span>
                <span className="wide block text-[38px] font-bold leading-[0.98] tracking-[-0.04em] md:text-[48px]">{twin.name}<span className="text-vermilion">.</span></span>
              </h1>
              <div className="mt-4 inline-block rounded border border-vermilion px-2 py-0.5 font-mono text-[10.5px] uppercase tracking-[0.08em] text-vermilion">
                Demo data
              </div>
              <p className="mt-4 text-[15px] leading-relaxed text-ink/70">
                Across all {N} questions, you agreed with {twin.name} <b className="num text-ink">{twin.agreement}%</b> of the time. This is a playful measure of choice similarity, not a claim about how models reason or what they would actually do.
              </p>
              <div className="mt-6 rounded border border-ink/20 bg-highlight/30 p-4">
                <div className="text-[13px] font-semibold text-ink/90">About these results</div>
                <p className="mt-1 text-[13px] leading-6 text-ink/65">
                  The model answers shown here are <b>fictional demo data</b> for this mockup. Real model evaluation requires measuring actual model actions in task scenarios, not self-reported choices.
                </p>
              </div>
              <div className="mt-6 flex flex-wrap gap-2">
                <button type="button" onClick={() => { setAnswers({}); setStep("intro"); }} className="btn-ghost">Start over</button>
              </div>
            </div>
            <div className="flex flex-col">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-rule px-5 py-4 md:px-8">
                <span className="kicker text-ink">Agreement with each model</span>
                <span className="font-mono text-[10.5px] uppercase tracking-[0.06em] text-vermilion">Demo data</span>
              </div>
              {models.map((m, k) => (
                <div key={m.id} className={`flex items-center justify-between border-b border-rule px-5 py-4 md:px-8 ${k === 0 ? "bg-highlight/30" : ""}`}>
                  <span className={`text-[16px] ${k === 0 ? "font-semibold" : "text-ink/70"}`}>{m.name}</span>
                  <span className="num text-[16px] font-semibold">{m.agreement}%</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-[1200px] border-b border-rule p-5 md:p-8">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="kicker text-ink">Question by question</span>
            <span className="font-mono text-[10.5px] uppercase tracking-[0.06em] text-ink/50">{twin.name}</span>
          </div>
          <div className="mt-4 space-y-2">
            {agreements.map(({ item, yours, theirs, match }) => (
              <div key={item.id} className={`flex items-start justify-between gap-4 rounded border p-4 ${match ? "border-moss/30 bg-moss/5" : "border-rule"}`}>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[15px] font-semibold">{item.title}</span>
                    {match ? (
                      <span className="rounded bg-moss px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-white">Match</span>
                    ) : (
                      <span className="rounded bg-ink/10 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-ink/60">Different</span>
                    )}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-4 text-[13px]">
                    <span className="text-ink/70">You: <b className="text-ink">{yours === 0 ? item.left : item.right}</b></span>
                    <span className="text-ink/70">{twin.name}: <b className="text-ink">{theirs === 0 ? item.left : item.right}</b></span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-[1200px] border-b border-rule p-5 md:p-8">
          <div className="mx-auto max-w-2xl text-center">
            <div className="kicker text-ink">Interactive mockup</div>
            <p className="mt-4 text-[15px] leading-relaxed text-ink/70">
              This is a prototype for exploring ethical alignment through playful similarity matching. Real model evaluation requires running actual task scenarios and measuring actions, not self-reported choices.
            </p>
            <p className="mt-4 text-[13px] leading-6 text-ink/55">
              Prototype on branch quiz-v4. <Link href="/quiz" className="link">Current quiz</Link>
            </p>
          </div>
        </section>
      </>
    );
  }

  return null;
}
