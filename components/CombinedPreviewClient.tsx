"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Eyebrow } from "./Brand";
import Share from "./Share";
import { QUIZ_V4_NEW } from "@/lib/quizV4ItemsNew";
import { MEASURED_DATA, calculateAgreementScore } from "@/lib/quizV4MeasuredData";

const N = QUIZ_V4_NEW.length;

const pct = (v: number) => `${Math.round(v * 100)}%`;

export default function CombinedPreviewClient() {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, 0 | 1>>({});
  const [justAnswered, setJustAnswered] = useState(false);

  const currentItem = QUIZ_V4_NEW[currentIdx];
  const hasAnswered = currentItem.id in answers;
  const userChoice = hasAnswered ? answers[currentItem.id] : null;

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [currentIdx]);

  const answerQuestion = (choice: 0 | 1) => {
    setAnswers(prev => ({ ...prev, [currentItem.id]: choice }));
    setJustAnswered(true);
  };

  const changeAnswer = () => {
    const newAnswers = { ...answers };
    delete newAnswers[currentItem.id];
    setAnswers(newAnswers);
    setJustAnswered(false);
  };

  const nextDilemma = () => {
    if (currentIdx < N - 1) {
      setCurrentIdx(currentIdx + 1);
      setJustAnswered(false);
    }
  };

  const answeredCount = Object.keys(answers).length;
  const showResults = answeredCount === N && hasAnswered;

  // Calculate match if all answered
  const userAnswersByOption = Object.fromEntries(
    Object.entries(answers).map(([scenarioId, choice]) => {
      const item = QUIZ_V4_NEW.find(q => q.id === scenarioId);
      if (!item) return [scenarioId, ""];
      const optionId = choice === 0 ? item.leftOptionId : item.rightOptionId;
      return [scenarioId, optionId];
    })
  );

  const { modelScores, bestMatch } = showResults 
    ? calculateAgreementScore(userAnswersByOption)
    : { modelScores: [], bestMatch: null };

  const twin = bestMatch ? MEASURED_DATA.models.find(m => m.id === bestMatch.modelId) : null;

  // Design preview banner
  const PreviewBanner = () => (
    <div className="border-b border-rule bg-panel px-4 py-2 text-center font-mono text-[11px] uppercase tracking-[0.06em] text-ink/60">
      Design Preview · Not Production · <a href="/" className="underline hover:text-vermilion">Return to site</a>
    </div>
  );

  if (showResults && twin) {
    const topScore = bestMatch!.score;
    
    return (
      <>
        <PreviewBanner />
        <section className="mx-auto max-w-[1200px] border-b border-rule">
          <div className="grid md:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
            <div className="border-b border-rule p-6 md:border-b-0 md:border-r md:p-10">
              <Eyebrow>{N} of {N} answered</Eyebrow>
              <div className="label mt-8">Your closest AI match</div>
              <div className="wide text-[36px] font-bold leading-none tracking-[-0.04em] md:text-[44px]">
                {twin.displayName}<span className="text-vermilion">.</span>
              </div>
              <p className="mt-5 text-[17px] leading-relaxed text-ink/70">
                <b className="num font-semibold text-ink">{topScore.toFixed(0)}% probability-weighted agreement</b> across all 10 questions. This is a playful measure of choice similarity, not a validated psychological assessment.
              </p>
              <p className="mt-6 text-[13px] leading-6 text-ink/50">
                Your agreement score compares your answers to each model's measured pattern. For each question, we calculate the percentage of that model's usable answers (excluding refusals and non-answers) that match your choice, then average across all questions.
              </p>
              <button type="button" onClick={() => { setAnswers({}); setCurrentIdx(0); setJustAnswered(false); }} className="mt-6 font-mono text-[11px] uppercase tracking-[0.06em] text-ink/50 hover:text-vermilion">
                ← Start over
              </button>
            </div>
            <div className="flex flex-col">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-rule px-5 py-4 md:px-8">
                <span className="kicker text-ink">Agreement with each model</span>
                <span className="font-mono text-[10.5px] uppercase tracking-[0.06em] text-ink/50">20 samples per question</span>
              </div>
              {modelScores.map((m, k) => (
                <div key={m.modelId} className={`flex items-center justify-between border-b border-rule px-5 py-4 md:px-8 ${k === 0 ? "bg-highlight/30" : ""}`}>
                  <span className={`text-[16px] ${k === 0 ? "font-semibold" : "text-ink/70"}`}>{m.displayName}</span>
                  <span className="num text-[16px] font-semibold">{m.score.toFixed(0)}%</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto grid max-w-[1200px] border-b border-rule md:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          <div className="bg-ink p-6 text-white md:p-10">
            <div className="kicker text-vermilion">Share your result</div>
            <p className="serif mt-4 text-[24px] leading-[1.2] md:text-[28px]">
              I'm helping more people understand how AI makes moral choices.
            </p>
            <p className="mt-4 text-[14px] leading-6 text-white/60">
              Every share leads with this, so a post about your result is also an invitation to think about how AI makes choices.
            </p>
            <div aria-label="Share card preview" className="mt-6 border border-white/20 bg-paper p-4 text-ink">
              <div className="text-[15px] font-semibold leading-snug">
                I'm helping more people understand how AI makes moral choices.
              </div>
              <div className="mt-3 border-l-4 border-ink bg-panel px-3 py-2">
                <div className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink/50">My closest AI match</div>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="wide text-[20px] font-bold">{twin.displayName}</span>
                  <span className="num text-[18px] font-semibold">{topScore.toFixed(0)}%</span>
                </div>
                <div className="mt-1 text-[12px] text-ink/60">Which AI are you most like?</div>
              </div>
            </div>
          </div>
          <div className="flex flex-col justify-between gap-6 p-6 md:p-10">
            <div>
              <div className="label mb-2">Preview only - sharing not implemented</div>
              <p className="text-[13px] leading-6 text-ink/60">
                In production, this would include Email, X, LinkedIn, Copy link, and download options. The shared link would carry only the model name and agreement percentage, not your individual answers.
              </p>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-[1200px] border-b border-rule p-6 md:p-10">
          <div className="label">Question by question · share of usable answers matching your choice</div>
          <div className="mt-4 space-y-3">
            {QUIZ_V4_NEW.map(item => {
              const userChoice = answers[item.id];
              const userOptionId = userChoice === 0 ? item.leftOptionId : item.rightOptionId;
              
              return (
                <div key={item.id} className="rounded border border-rule p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="text-[15px] font-semibold">{item.title}</div>
                      <div className="mt-2 text-[13px] text-ink/70">
                        You chose: <b className="text-ink">{userChoice === 0 ? item.left : item.right}</b>
                      </div>
                      <div className="mt-3 grid gap-2 text-[13px] md:grid-cols-4">
                        {MEASURED_DATA.models.map(model => {
                          const result = MEASURED_DATA.results.find(
                            r => r.model_id === model.id && r.scenario_id === item.id
                          );
                          if (!result) return null;

                          const count = result.option_counts[userOptionId] || 0;
                          const usable = result.valid_count;
                          const pct = usable > 0 ? Math.round((count / usable) * 100) : 0;

                          return (
                            <div key={model.id} className="rounded border border-rule bg-panel p-2">
                              <div className="text-[11px] font-medium">{model.displayName}</div>
                              <div className="num mt-1 text-[15px] font-semibold">{count}/{usable} ({pct}%)</div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </>
    );
  }

  if (!hasAnswered || !justAnswered) {
    // Question view
    return (
      <>
        <PreviewBanner />
        <section className="mx-auto max-w-[1200px] border-b border-rule">
          <div className="flex flex-wrap items-stretch">
            {QUIZ_V4_NEW.map((item, i) => (
              <button
                key={item.id}
                onClick={() => { setCurrentIdx(i); setJustAnswered(false); }}
                className={`flex items-center gap-3 border-r border-rule px-5 py-4 font-mono text-[11.5px] uppercase tracking-[0.08em] md:px-8 ${
                  i === currentIdx ? "bg-ink text-white" : item.id in answers ? "text-ink" : "text-ink/60 hover:bg-panel"
                }`}
              >
                <span className="num text-[11px] opacity-60">{String(i + 1).padStart(2, "0")}</span>
                {item.title}
              </button>
            ))}
            <div className="hatch hidden flex-1 md:block" />
          </div>
        </section>

        <section className="mx-auto max-w-[1200px]">
          <div className="grid gap-8 px-6 py-10 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] md:gap-10 md:px-12 md:py-12">
            <div>
              <Eyebrow>Step 1 of 2 · {currentIdx + 1} of {N}</Eyebrow>
              <h1 className="wide mt-6 text-[40px] font-bold leading-[0.96] tracking-[-0.045em] md:text-[64px]">
                {currentItem.title}
              </h1>
              <div className="mt-6 space-y-4">
                {currentItem.scenario.split('\n\n').map((para, i) => (
                  <p key={i} className="text-[16px] leading-relaxed text-ink/80">{para}</p>
                ))}
              </div>
              <div className="mt-8 space-y-6">
                <div className="rounded border border-ink/15 bg-paper p-5">
                  <div className="label !mb-2">Background</div>
                  <p className="text-[14px] leading-relaxed text-ink/75">{currentItem.background}</p>
                  {currentItem.sourceUrl && (
                    <a href={currentItem.sourceUrl} target="_blank" rel="noopener noreferrer" className="link mt-2 inline-block text-[13px]">
                      Learn more →
                    </a>
                  )}
                </div>
                <div className="rounded border border-vermilion/20 bg-highlight/30 p-5">
                  <div className="label !mb-2">Why it matters for AI</div>
                  <p className="text-[14px] leading-relaxed text-ink/75">{currentItem.aiRelevance}</p>
                </div>
              </div>
            </div>
            <div className="flex flex-col gap-3">
              <div className="label">Your answer</div>
              <p className="text-[14px] text-ink/70">There is no right answer, and we won't save your choice. It stays in your browser.</p>
              <button
                type="button"
                onClick={() => answerQuestion(0)}
                className="btn-primary justify-start !text-left"
              >
                {currentItem.left}
              </button>
              <button
                type="button"
                onClick={() => answerQuestion(1)}
                className="btn-primary justify-start !text-left"
              >
                {currentItem.right}
              </button>
            </div>
          </div>
        </section>
      </>
    );
  }

  // Comparison view (after answering)
  const modelResults = MEASURED_DATA.models.map(model => {
    const result = MEASURED_DATA.results.find(
      r => r.model_id === model.id && r.scenario_id === currentItem.id
    );
    if (!result) return null;

    const leftCount = result.option_counts[currentItem.leftOptionId] || 0;
    const rightCount = result.option_counts[currentItem.rightOptionId] || 0;
    const usable = result.valid_count;
    
    const leftPct = usable > 0 ? leftCount / usable : 0;
    const rightPct = usable > 0 ? rightCount / usable : 0;

    return {
      model,
      result,
      leftCount,
      rightCount,
      leftPct,
      rightPct,
      usable,
      refusal: result.refusal_count,
      nonAnswer: result.non_answer_count
    };
  }).filter(Boolean);

  const userChoiceText = userChoice === 0 ? currentItem.left : currentItem.right;
  const shareText = `I'm helping more people understand how AI makes moral choices. ${currentItem.title}? Answer it, then see how AI models chose.`;
  const sharePath = `/preview?q=${currentIdx}`;

  return (
    <>
      <PreviewBanner />
      <section className="mx-auto max-w-[1200px] border-b border-rule">
        <div className="flex flex-wrap items-stretch">
          {QUIZ_V4_NEW.map((item, i) => (
            <button
              key={item.id}
              onClick={() => { setCurrentIdx(i); setJustAnswered(false); }}
              className={`flex items-center gap-3 border-r border-rule px-5 py-4 font-mono text-[11.5px] uppercase tracking-[0.08em] md:px-8 ${
                i === currentIdx ? "bg-ink text-white" : item.id in answers ? "text-ink" : "text-ink/60 hover:bg-panel"
              }`}
            >
              <span className="num text-[11px] opacity-60">{String(i + 1).padStart(2, "0")}</span>
              {item.title}
            </button>
          ))}
          <div className="hatch hidden flex-1 md:block" />
        </div>
      </section>

      <section className="mx-auto max-w-[1200px] border-b border-rule">
        <div className="grid md:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
          <div className="border-b border-rule p-6 md:border-b-0 md:border-r md:p-10">
            <Eyebrow>Step 2 of 2 · how models chose</Eyebrow>
            <div className="label mt-8">You chose</div>
            <div className="wide text-[36px] font-bold leading-none tracking-[-0.04em] md:text-[44px]">
              {userChoiceText}<span className="text-vermilion">.</span>
            </div>
            <p className="mt-5 text-[17px] leading-relaxed text-ink/70">
              Here's how four AI models answered this same question, measured from 20 samples each.
            </p>
            <p className="mt-6 text-[13px] leading-6 text-ink/50">
              Models: Measured responses from 20 runs per model. Percentages show the share of usable answers (excluding refusals and non-answers) that chose each option.
            </p>
            <button type="button" onClick={changeAnswer} className="mt-6 font-mono text-[11px] uppercase tracking-[0.06em] text-ink/50 hover:text-vermilion">
              ← Change my answer
            </button>
          </div>
          <div className="flex flex-col">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-rule px-5 py-4 md:px-8">
              <span className="kicker text-ink">AI model responses</span>
              <span className="font-mono text-[10.5px] uppercase tracking-[0.06em] text-ink/50">20 samples each</span>
            </div>
            {modelResults.map((mr, k) => {
              if (!mr) return null;
              const { model, leftCount, rightCount, leftPct, rightPct, usable, refusal, nonAnswer } = mr;
              const modelChose = userChoice === 0 ? leftPct : rightPct;
              
              return (
                <div key={model.id} className="border-b border-rule px-5 py-4 md:px-8">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-[15px] font-semibold">{model.displayName}</span>
                    <span className="num text-[13px] text-ink/60">{pct(modelChose)} chose what you chose</span>
                  </div>
                  <div className="grid gap-2 text-[13px]">
                    <div className={`flex items-center justify-between ${userChoice === 0 ? 'font-medium text-ink' : 'text-ink/70'}`}>
                      <span>{currentItem.left}</span>
                      <span className="num">{leftCount}/{usable} ({pct(leftPct)})</span>
                    </div>
                    <div className={`flex items-center justify-between ${userChoice === 1 ? 'font-medium text-ink' : 'text-ink/70'}`}>
                      <span>{currentItem.right}</span>
                      <span className="num">{rightCount}/{usable} ({pct(rightPct)})</span>
                    </div>
                    {(refusal > 0 || nonAnswer > 0) && (
                      <div className="mt-1 space-y-1 text-[12px] text-ink/50">
                        {refusal > 0 && <div>Refusal: {refusal}/20</div>}
                        {nonAnswer > 0 && <div>No answer: {nonAnswer}/20</div>}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            <p className="px-5 py-3 font-mono text-[10.5px] leading-5 text-ink/50 md:px-8">
              Percentages are calculated among usable answers only. Refusals and non-answers are not counted as opposing choices. Data from 800 measured samples total across 4 models and 10 questions.
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-[1200px] border-b border-rule md:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="bg-panel p-6 md:p-10">
          <div className="label">Continue</div>
          <p className="mt-3 text-[16px] leading-relaxed text-ink/70">
            {answeredCount < N 
              ? `You've answered ${answeredCount} of {N} questions. Continue to see your closest AI model match, or stop here and share this dilemma.`
              : "You've answered all 10 questions. See your closest AI model match."}
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            {currentIdx < N - 1 ? (
              <button onClick={nextDilemma} className="btn-primary">
                <span className="h-2 w-2 bg-vermilion" />
                Next: {QUIZ_V4_NEW[currentIdx + 1].title} →
              </button>
            ) : answeredCount === N ? (
              <button onClick={() => setJustAnswered(false)} className="btn-primary">
                <span className="h-2 w-2 bg-vermilion" />
                See your closest match →
              </button>
            ) : null}
          </div>
        </div>
        <div className="flex flex-col justify-between gap-6 p-6 md:p-10">
          <div>
            <div className="label mb-2">Share this dilemma</div>
            <p className="text-[13px] leading-6 text-ink/60">
              Preview only - sharing shares the question, not your answer.
            </p>
          </div>
          <div className="text-[12px] text-ink/50">
            Progress: {answeredCount} of {N} answered
          </div>
        </div>
      </section>
    </>
  );
}
