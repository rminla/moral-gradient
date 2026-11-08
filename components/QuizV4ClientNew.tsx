"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Eyebrow } from "./Brand";
import { QUIZ_V4_NEW, type QuizV4ItemNew } from "@/lib/quizV4ItemsNew";
import { MODELS, getModelResults, calculateAgreementScore } from "@/lib/quizV4MeasuredData";

const N = QUIZ_V4_NEW.length;

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
    <section className="border-b border-rule">
      <div className="relative mx-auto max-w-[1200px]">
        <div aria-hidden className="pixel-grid absolute inset-0 [mask-image:linear-gradient(to_bottom,black,transparent_85%)]" />
        <div className="relative grid gap-10 px-6 pb-14 pt-12 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] md:px-12 md:pb-16 md:pt-16">
          <div>
            <Eyebrow>{N} ethical dilemmas · about 5 minutes</Eyebrow>
            <h1 className="wide mt-6 text-[40px] font-bold leading-[0.96] tracking-[-0.045em] md:text-[64px]">Who's your AI ethical twin?</h1>
            <p className="mt-6 max-w-xl text-[18px] leading-relaxed text-ink/70">{N} ethical dilemmas, some famous and some everyday. Pick what you'd do. Then see which AI model's pattern of responses is closest to yours.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <button type="button" onClick={() => { setAnswers({}); setStep(0); }} className="btn-primary"><span className="h-2 w-2 bg-vermilion" />Start</button>
            </div>
            <p className="mt-5 text-[13.5px] leading-6 text-ink/55">No right answers. This is for educational purposes only. Nothing you answer is stored.</p>
          </div>
          <div className="flex flex-col gap-3 self-end">
            <div className="label">What to expect</div>
            {[
              ["6 classic problems", "Famous ethical thought experiments from philosophy: the trolley problem, Nozick's experience machine, Rawls's veil of ignorance, and more."],
              ["4 everyday dilemmas", "Original scenarios about honesty, loyalty, fairness, and generosity in situations you might actually face."],
              ["Background and context", "Each question shows where it came from and why it matters for AI before you answer."],
              ["Measured model data", "Results from 800 samples per model across all questions, measured independently and verified."],
            ].map(([t, b]) => <div key={t} className="border border-rule bg-paper p-4"><div className="text-[15px] font-semibold">{t}</div><p className="mt-1 text-[13.5px] leading-6 text-ink/60">{b}</p></div>)}
          </div>
        </div>
      </div>
    </section>
  );

  if (typeof step === "number") {
    const item = QUIZ_V4_NEW[step];
    const answered = Object.keys(answers).length;
    return (
      <section className="border-b border-rule">
        <div className="mx-auto max-w-[1200px]">
          {/* Header with progress */}
          <div className="border-b border-rule px-6 py-6 md:px-12">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <Eyebrow>Question {step + 1} of {N}</Eyebrow>
                <h1 className="mt-2 text-[22px] font-bold leading-tight tracking-[-0.02em] md:text-[26px]">{item.title}</h1>
              </div>
              <span className="font-mono text-[10.5px] uppercase tracking-[0.08em] text-ink/45">{item.category === "classic" ? "Classic problem" : "Everyday dilemma"}</span>
            </div>
            <div className="mt-5 grid gap-1" style={{ gridTemplateColumns: `repeat(${N}, minmax(0, 1fr))` }}>
              {QUIZ_V4_NEW.map((_, j) => <span key={j} className={`h-1.5 ${j < step ? "bg-ink" : j === step ? "bg-vermilion" : "bg-ink/10"}`} />)}
            </div>
          </div>

          {/* Main content: two-column on desktop, stacked on mobile */}
          <div className="grid gap-8 px-6 py-10 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] md:gap-10 md:px-12 md:py-12">
          
          {/* Left column: Scenario and choices */}
          <div>
            {/* Scenario */}
            <div className="space-y-4">
              {item.scenario.split('\n\n').map((para, i) => (
                <p key={i} className="text-[16px] leading-relaxed text-ink/80">{para}</p>
              ))}
            </div>

            {/* Mobile-only context (shown before choices on mobile) */}
            <div className="mt-8 space-y-6 md:hidden">
              <div className="rounded border border-ink/15 bg-paper p-5">
                <div className="label !mb-2">Background</div>
                <p className="text-[14px] leading-relaxed text-ink/75">{item.background}</p>
                {item.sourceUrl && (
                  <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer" className="link mt-2 inline-block text-[13px]">
                    Learn more
                  </a>
                )}
              </div>
              <div className="rounded border border-vermilion/20 bg-highlight/30 p-5">
                <div className="label !mb-2">Why it matters for AI</div>
                <p className="text-[14px] leading-relaxed text-ink/75">{item.aiRelevance}</p>
              </div>
            </div>

            {/* Question prompt */}
            <div className="mt-8">
              <h2 className="text-[18px] font-semibold leading-snug text-ink/90 md:text-[20px]">{item.question}</h2>
            </div>

            {/* Choices */}
            <div className="mt-5 space-y-3">
              {([[0, item.left], [1, item.right]] as const).map(([v, t]) => (
                <button 
                  key={v} 
                  type="button" 
                  onClick={() => answerQuestion(step, v)} 
                  className="btn-ghost !w-full !justify-start !border-ink !py-4 !text-left !text-[15px] hover:!bg-ink hover:!text-white"
                >
                  {t}
                </button>
              ))}
            </div>

            {/* Navigation */}
            {answered > 0 && (
              <div className="mt-8 flex justify-between border-t border-rule pt-5 font-mono text-[11px] uppercase tracking-[0.06em] text-ink/50">
                <button type="button" onClick={() => setStep(step - 1)} className="uppercase hover:text-vermilion">Back</button>
                <span>{answered} of {N} answered</span>
              </div>
            )}
          </div>

          {/* Right sidebar: Background and AI relevance (desktop only) */}
          <div className="hidden md:block">
            <div className="sticky top-8 space-y-6">
              <div className="rounded border border-ink/15 bg-paper p-6">
                <div className="label !mb-2.5">Background</div>
                <p className="text-[15px] leading-relaxed text-ink/75">{item.background}</p>
                {item.sourceUrl && (
                  <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer" className="link mt-3 inline-block text-[14px]">
                    Learn more →
                  </a>
                )}
              </div>
              <div className="rounded border border-vermilion/20 bg-highlight/30 p-6">
                <div className="label !mb-2.5">Why it matters for AI</div>
                <p className="text-[15px] leading-relaxed text-ink/75">{item.aiRelevance}</p>
              </div>
            </div>
          </div>
        </div>
        </div>
      </section>
    );
  }

  if (step === "result") {
    const userAnswersByOption = Object.fromEntries(
      Object.entries(answers).map(([scenarioId, choice]) => {
        const item = QUIZ_V4_NEW.find(q => q.id === scenarioId);
        if (!item) return [scenarioId, ""];
        const optionId = choice === 0 ? item.leftOptionId : item.rightOptionId;
        return [scenarioId, optionId];
      })
    );

    const { modelScores, bestMatch } = calculateAgreementScore(userAnswersByOption);
    const twin = bestMatch ? MODELS.find(m => m.id === bestMatch.modelId) : null;

    if (!twin) return null;

    return (
      <>
        <section className="border-b border-rule">
          <div className="mx-auto max-w-[1200px]">
            <div className="grid md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
              <div className="border-b border-rule p-6 md:border-b-0 md:border-r md:p-12">
              <Eyebrow>Your result · {N} of {N} answered</Eyebrow>
              <h1 className="mt-8">
                <span className="label block">Your AI ethical twin is</span>
                <span className="wide block text-[38px] font-bold leading-[0.98] tracking-[-0.04em] md:text-[48px]">{twin.displayName}<span className="text-vermilion">.</span></span>
              </h1>
              <p className="mt-4 text-[15px] leading-relaxed text-ink/70">
                Across all {N} questions, you matched {twin.displayName}'s pattern with <b className="num text-ink">{(bestMatch?.score || 0).toFixed(0)}%</b> probability-weighted agreement. This is a playful measure of choice similarity, not a claim about how models reason or what they would actually do.
              </p>
              <div className="mt-6 rounded border border-ink/20 bg-highlight/30 p-4">
                <div className="text-[13px] font-semibold text-ink/90">About these results</div>
                <p className="mt-1 text-[13px] leading-6 text-ink/65">
                  Model results are from 20 samples per question. Models saw only the scenario text, the two options, and a letter-choice prompt. They did not see the Background or "Why it matters for AI" sections.
                </p>
                <p className="mt-2 text-[13px] leading-6 text-ink/65">
                  This is for fun and educational purposes only, not a validated psychological or behavioral assessment.
                </p>
              </div>
              <div className="mt-6 flex flex-wrap gap-2">
                <button type="button" onClick={() => { setAnswers({}); setStep("intro"); }} className="btn-ghost">Start over</button>
              </div>
              </div>
              <div className="flex flex-col">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-rule px-6 py-4 md:px-12">
                  <span className="kicker text-ink">Agreement with each model</span>
                  <span className="font-mono text-[10.5px] uppercase tracking-[0.06em] text-ink/50">20 samples per question</span>
                </div>
                {modelScores.map((m, k) => (
                  <div key={m.modelId} className={`flex items-center justify-between border-b border-rule px-6 py-4 md:px-12 ${k === 0 ? "bg-highlight/30" : ""}`}>
                    <span className={`text-[16px] ${k === 0 ? "font-semibold" : "text-ink/70"}`}>{m.displayName}</span>
                    <span className="num text-[16px] font-semibold">{m.score.toFixed(0)}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="border-b border-rule">
          <div className="mx-auto max-w-[1200px] px-6 py-10 md:px-12 md:py-12">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="kicker text-ink">Question by question</span>
            <span className="font-mono text-[10.5px] uppercase tracking-[0.06em] text-ink/50">{twin.displayName} · 20 samples per question</span>
          </div>
          <div className="mt-4 space-y-2">
            {QUIZ_V4_NEW.map(item => {
              const userChoice = answers[item.id];
              const userOptionId = userChoice === 0 ? item.leftOptionId : item.rightOptionId;
              const result = getModelResults(twin.id, item.id);
              
              if (!result) return null;

              const totalValid = Object.values(result.optionCounts).reduce((sum, count) => sum + count, 0);
              const userChoiceCount = result.optionCounts[userOptionId] || 0;
              const userChoicePct = totalValid > 0 ? Math.round((userChoiceCount / totalValid) * 100) : 0;
              
              const leftCount = result.optionCounts[item.leftOptionId] || 0;
              const rightCount = result.optionCounts[item.rightOptionId] || 0;
              const leftPct = totalValid > 0 ? Math.round((leftCount / totalValid) * 100) : 0;
              const rightPct = totalValid > 0 ? Math.round((rightCount / totalValid) * 100) : 0;

              const refusalCount = result.refusalCount;
              const nonAnswerCount = result.nonAnswerCount;
              const nonvalidCount = refusalCount + nonAnswerCount;

              const strongMatch = userChoicePct >= 70;
              
              return (
                <div key={item.id} className={`rounded border p-4 ${strongMatch ? "border-moss/30 bg-moss/5" : "border-rule"}`}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[15px] font-semibold">{item.title}</span>
                        {strongMatch && (
                          <span className="rounded bg-moss px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-white">Strong match</span>
                        )}
                      </div>
                      <div className="mt-2 text-[13px] text-ink/70">
                        You chose: <b className="text-ink">{userChoice === 0 ? item.left : item.right}</b>
                      </div>
                      <div className="mt-3 space-y-1.5 text-[13px]">
                        <div className="flex items-center justify-between gap-3">
                          <span className={userChoice === 0 ? "font-medium text-ink" : "text-ink/70"}>{item.left}</span>
                          <span className={`num font-medium ${userChoice === 0 ? "text-ink" : "text-ink/70"}`}>{leftCount}/{result.n} ({leftPct}%)</span>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span className={userChoice === 1 ? "font-medium text-ink" : "text-ink/70"}>{item.right}</span>
                          <span className={`num font-medium ${userChoice === 1 ? "text-ink" : "text-ink/70"}`}>{rightCount}/{result.n} ({rightPct}%)</span>
                        </div>
                        {nonvalidCount > 0 && (
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-ink/50">{refusalCount > 0 ? "Refusal" : "No answer"}</span>
                            <span className="num font-medium text-ink/50">{nonvalidCount}/{result.n}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          </div>
        </section>

        <section className="border-b border-rule">
          <div className="mx-auto max-w-[1200px] px-6 py-10 md:px-12 md:py-12">
            <div className="mx-auto max-w-2xl">
              <div className="kicker text-center text-ink">About this quiz</div>
              <p className="mt-4 text-[15px] leading-relaxed text-ink/70">
                This quiz explores ethical alignment through choice similarity matching. Results are based on 800 measured samples (20 per question per model) collected independently and verified.
              </p>
              <p className="mt-4 text-[15px] leading-relaxed text-ink/70">
                Models saw only scenario text, options, and a letter-choice prompt. They did not see educational background, philosophical origins, or AI relevance sections. This is for educational purposes only, not a validated psychological or behavioral assessment.
              </p>
            </div>
          </div>
        </section>
      </>
    );
  }

  return null;
}
