"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Eyebrow } from "./Brand";
import Share from "./Share";
import { QUIZ_V4_NEW, type QuizV4ItemNew } from "@/lib/quizV4ItemsNew";
import { MODELS, getModelResults, calculateAgreementScore } from "@/lib/quizV4MeasuredData";
import { WRAPPER } from "@/lib/shareCopy";

const N = QUIZ_V4_NEW.length;

export default function QuizV4ClientV9() {
  const [step, setStep] = useState<"intro" | number | "result">("intro");
  const [answers, setAnswers] = useState<Record<string, 0 | 1>>({});
  const [showModelDetails, setShowModelDetails] = useState<Record<string, boolean>>({});

  useEffect(() => { window.scrollTo({ top: 0, behavior: "smooth" }); }, [step]);

  const answerQuestion = (itemIdx: number, choice: 0 | 1) => {
    const item = QUIZ_V4_NEW[itemIdx];
    setAnswers(prev => ({ ...prev, [item.id]: choice }));
  };

  const goToQuestion = (idx: number) => setStep(idx);
  const isLastQuestion = typeof step === "number" && step === N - 1;
  const allAnswered = Object.keys(answers).length === N;

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
    const answered = answers[item.id] !== undefined;
    const userChoice = answers[item.id];

    // Calculate model agreement for this question
    const modelAgreement = MODELS.map(model => {
      const result = getModelResults(model.id, item.id);
      if (!result) return null;
      
      if (answered) {
        const userOptionId = userChoice === 0 ? item.leftOptionId : item.rightOptionId;
        const userChoiceCount = result.optionCounts[userOptionId] || 0;
        const agreement = result.validCount > 0 ? Math.round((userChoiceCount / result.validCount) * 100) : 0;
        const agreed = agreement >= 50;
        return { model, result, agreement, agreed };
      }
      return null;
    }).filter(Boolean) as Array<{ model: typeof MODELS[0]; result: NonNullable<ReturnType<typeof getModelResults>>; agreement: number; agreed: boolean }>;

    const allAgree = answered && modelAgreement.every(m => m.agreed);
    const noneAgree = answered && modelAgreement.every(m => !m.agreed);
    const agreementSummary = answered
      ? allAgree
        ? "All 4 models agreed with you"
        : noneAgree
        ? "None of the 4 models agreed with you"
        : `${modelAgreement.filter(m => m.agreed).length} of 4 models agreed with you`
      : "";

    const detailsVisible = showModelDetails[item.id] || false;

    return (
      <section className="border-b border-rule">
        <div className="mx-auto max-w-[920px]">
          {/* Header */}
          <div className="border-b border-rule px-6 py-6 md:px-8">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Eyebrow>Question {step + 1} of {N} · {item.title}</Eyebrow>
              <span className="font-mono text-[10.5px] uppercase tracking-[0.08em] text-ink/45">{item.category === "classic" ? "Classic problem" : "Everyday dilemma"}</span>
            </div>
            <div className="mt-5 grid gap-1" style={{ gridTemplateColumns: `repeat(${N}, minmax(0, 1fr))` }}>
              {QUIZ_V4_NEW.map((_, j) => <span key={j} className={`h-1.5 ${answers[QUIZ_V4_NEW[j].id] !== undefined ? "bg-ink" : j === step ? "bg-vermilion" : "bg-ink/10"}`} />)}
            </div>
          </div>

          {!answered ? (
            /* Question view */
            <div className="px-6 py-10 md:px-8 md:py-12">
              {/* Scenario */}
              <div className="space-y-4">
                {item.scenario.split('\n\n').map((para, i) => (
                  <p key={i} className="text-[17px] leading-relaxed text-ink/80">{para}</p>
                ))}
              </div>

              {/* Question prompt */}
              <div className="mt-8">
                <h2 className="wide text-[32px] font-bold leading-[1] tracking-[-0.04em] text-ink md:text-[42px]">{item.question}</h2>
              </div>

              {/* Choices */}
              <div className="mt-6 space-y-3">
                <div className="label">What would you do?</div>
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
              <div className="mt-8 flex justify-between border-t border-rule pt-5 font-mono text-[11px] uppercase tracking-[0.06em] text-ink/50">
                <button type="button" onClick={() => setStep(step === 0 ? "intro" : step - 1)} className="uppercase hover:text-vermilion">← Back</button>
                <span>{Object.keys(answers).length} of {N} answered</span>
              </div>
            </div>
          ) : (
            /* After answer view */
            <>
              {/* Scenario (repeated) */}
              <div className="border-b border-rule px-6 py-8 md:px-8">
                <div className="space-y-3">
                  {item.scenario.split('\n\n').map((para, i) => (
                    <p key={i} className="text-[15px] leading-relaxed text-ink/75">{para}</p>
                  ))}
                </div>
                <h2 className="wide mt-6 text-[28px] font-bold leading-[1] tracking-[-0.04em] text-ink/90 md:text-[36px]">{item.question}</h2>
              </div>

              <div className="px-6 py-8 md:px-8">
                {/* You chose */}
                <div>
                  <div className="label">You chose</div>
                  <div className="wide mt-2 text-[32px] font-bold leading-[1] tracking-[-0.04em] md:text-[42px]">
                    {userChoice === 0 ? item.left : item.right}<span className="text-vermilion">.</span>
                  </div>
                </div>

                {/* Action buttons */}
                <div className="mt-6 flex flex-wrap items-center gap-3">
                  <button 
                    type="button" 
                    onClick={() => {
                      if (isLastQuestion && allAnswered) {
                        setStep("result");
                      } else {
                        setStep(step + 1);
                      }
                    }}
                    className="btn-primary"
                  >
                    {isLastQuestion && allAnswered ? "See your closest match →" : "Next question →"}
                  </button>
                  <button 
                    type="button" 
                    onClick={() => {
                      const newAnswers = { ...answers };
                      delete newAnswers[item.id];
                      setAnswers(newAnswers);
                    }}
                    className="font-mono text-[12px] uppercase tracking-[0.06em] text-ink/60 underline hover:text-vermilion"
                  >
                    Change answer
                  </button>
                </div>

                {/* AI models on this question */}
                <div className="mt-10 border-t border-rule pt-8">
                  <div className="label">AI models on this question</div>
                  <div className="mt-2 text-[18px] font-semibold leading-snug text-ink">{agreementSummary}</div>
                  
                  {/* Model chips */}
                  <div className="mt-4 flex flex-wrap gap-2">
                    {modelAgreement.map(({ model, agreed, agreement }) => (
                      <div key={model.id} className="inline-flex items-center gap-2 rounded-full border border-ink/20 px-3 py-1.5 text-[13px]">
                        <span className="text-ink/80">{model.displayName}</span>
                        {agreed ? (
                          <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 text-vermilion" fill="currentColor">
                            <path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.75.75 0 0 1 1.06-1.06L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0Z" />
                          </svg>
                        ) : (
                          <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 text-ink/40" fill="currentColor">
                            <path d="M3.72 3.72a.75.75 0 0 1 1.06 0L8 6.94l3.22-3.22a.75.75 0 1 1 1.06 1.06L9.06 8l3.22 3.22a.75.75 0 1 1-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 0 1-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 0 1 0-1.06Z" />
                          </svg>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Show details toggle */}
                  <button 
                    type="button"
                    onClick={() => setShowModelDetails(prev => ({ ...prev, [item.id]: !prev[item.id] }))}
                    className="mt-4 font-mono text-[12px] uppercase tracking-[0.06em] text-ink/60 underline hover:text-vermilion"
                  >
                    {detailsVisible ? "▼ Hide" : "▶ Show"} details
                  </button>

                  {/* Details panel */}
                  {detailsVisible && (
                    <div className="mt-4 space-y-3">
                      {modelAgreement.map(({ model, result, agreement }) => {
                        const leftCount = result.optionCounts[item.leftOptionId] || 0;
                        const rightCount = result.optionCounts[item.rightOptionId] || 0;
                        const refusalCount = result.refusalCount;
                        const nonAnswerCount = result.nonAnswerCount;
                        const nonvalidCount = refusalCount + nonAnswerCount;
                        const usableCount = result.validCount;
                        
                        const leftPct = usableCount > 0 ? Math.round((leftCount / usableCount) * 100) : 0;
                        const rightPct = usableCount > 0 ? Math.round((rightCount / usableCount) * 100) : 0;

                        return (
                          <div key={model.id} className="rounded border border-rule bg-paper p-4">
                            <div className="text-[14px] font-semibold">{model.displayName}</div>
                            <div className="mt-2 space-y-1.5 text-[13px]">
                              <div className="flex items-center justify-between gap-3">
                                <span className={userChoice === 0 ? "font-medium text-ink" : "text-ink/70"}>{item.left}</span>
                                <span className={`num font-medium ${userChoice === 0 ? "text-ink" : "text-ink/70"}`}>{leftCount}/{usableCount} ({leftPct}%)</span>
                              </div>
                              <div className="flex items-center justify-between gap-3">
                                <span className={userChoice === 1 ? "font-medium text-ink" : "text-ink/70"}>{item.right}</span>
                                <span className={`num font-medium ${userChoice === 1 ? "text-ink" : "text-ink/70"}`}>{rightCount}/{usableCount} ({rightPct}%)</span>
                              </div>
                              {nonvalidCount > 0 && (
                                <div className="flex items-center justify-between gap-3">
                                  <span className="text-ink/50">{refusalCount > 0 ? "Refusal" : "No answer"}</span>
                                  <span className="num font-medium text-ink/50">{nonvalidCount}/{result.n}</span>
                                </div>
                              )}
                            </div>
                            {usableCount < result.n && (
                              <div className="mt-2 text-[11px] text-ink/45">
                                Percentages among {usableCount} usable answers; {nonvalidCount} of {result.n} refused or gave no answer
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Share section */}
                <div className="mt-10 border-t border-rule pt-8">
                  <Share 
                    path={`/quiz-v4/q/${item.id}?a=${userChoice === 0 ? item.leftOptionId : item.rightOptionId}`}
                    text={`${WRAPPER} I answered this ethical dilemma on Moral Gradient. ${agreementSummary.toLowerCase()}.`}
                    subject={`${item.title} - A dilemma for you`}
                    emailBody={`${WRAPPER}\n\n${item.question}\n\n${item.scenario.replace(/\n\n/g, '\n')}\n\nI chose: ${userChoice === 0 ? item.left : item.right}\n\n${agreementSummary}. Try it yourself and see how AI models chose.`}
                    label="Share your answer"
                  />
                  <p className="mt-2 text-[13px] leading-6 text-ink/60">The card shows the question and your answer.</p>
                </div>

                {/* Background and AI relevance */}
                <div className="mt-10 space-y-6 border-t border-rule pt-8">
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

                {/* Navigation */}
                <div className="mt-8 flex justify-between border-t border-rule pt-5 font-mono text-[11px] uppercase tracking-[0.06em] text-ink/50">
                  <button type="button" onClick={() => setStep(step === 0 ? "intro" : step - 1)} className="uppercase hover:text-vermilion">← Back</button>
                  <button type="button" onClick={() => setStep("intro")} className="uppercase hover:text-vermilion">← Start over</button>
                </div>
              </div>
            </>
          )}
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
            <div className="mx-auto max-w-2xl">
              <div className="kicker text-center text-ink">About this quiz</div>
              <p className="mt-4 text-[15px] leading-relaxed text-ink/70">
                This quiz explores ethical alignment through choice similarity matching. Results are based on 800 measured samples (20 per question per model) collected independently and verified.
              </p>
              <p className="mt-4 text-[15px] leading-relaxed text-ink/70">
                Models saw only scenario text, options, and a letter-choice prompt. They did not see educational background, philosophical origins, or AI relevance sections. This is for educational purposes only, not a validated psychological or behavioral assessment.
              </p>
              <div className="mt-6 text-center">
                <button type="button" onClick={() => { setAnswers({}); setStep("intro"); }} className="btn-ghost">Take the quiz again</button>
              </div>
            </div>
          </div>
        </section>
      </>
    );
  }

  return null;
}
