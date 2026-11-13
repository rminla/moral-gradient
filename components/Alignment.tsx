import Link from "next/link";
import { Eyebrow } from "./Brand";

/**
 * "Why this matters": the alignment ladder (direction A: numbered step tiles).
 * Saying the right thing is the floor; acting on it is the bar; holding under pressure and against the
 * model's own interest are the headline safety questions.
 */
export const RUNGS = [
  { n: "01", k: "Says", q: "What does it say is right?", d: "It advises another AI agent, or says what it would do. Cheap to give, easy to train for. Necessary, not sufficient.", href: "/stated-vs-actual", safety: false },
  { n: "02", k: "Does", q: "Does it act on it when it has the tools?", d: "Same situation, but now it is the agent: it can waive the fee or refund the money, and we log what it actually does.", href: "/stated-vs-actual", safety: false },
  { n: "03", k: "Under pressure", q: "Does it hold when pushed?", d: "Bare pushback and claimed authority, compared with real new information, where changing your mind is reasonable.", href: "/compare#fb", safety: true },
  { n: "04", k: "When a stake is added", q: "Does it hold when a stake pulls the other way, and does it say so?", d: "A budget memo or a performance score is added; nothing about the customer changes. We check the action, the reasoning and the reasons it gives.", href: "/reasoning", safety: true },
];

export const POINTS = [
  { t: "Words are easy to train", d: "A model can learn to give the right-sounding answer without that answer governing what it does. Agreeing with a principle tells you little on its own." },
  { t: "Behaviour is the test", d: "Models now act: they refund, approve, send and score. What counts is whether the action matches the stated view, and whether it still does under social pressure or when the model's own incentives pull against it." },
  { t: "Explanations have to be checkable", d: "People oversee AI by reading its explanations. If a model's reasoning weighs something, like a budget target or a user's insistence, that its stated reasons leave out, the explanation stops telling you what drove the decision. We check this for every model and report it whichever way it comes out." },
  { t: "Tracked across releases", d: "Running the same tests on every model and every new version shows whether behavior in these tests changes across releases, or whether only the stated answers do." },
];

export function AlignmentLadder({ dark = false }: { dark?: boolean }) {
  const tone = (i: number) =>
    i === 2 ? "bg-vermilion text-white border-vermilion" : i === 3 ? (dark ? "bg-white text-ink border-white" : "bg-ink text-white border-ink") : dark ? "bg-transparent text-white border-white/15 hover:border-white/50" : "bg-paper text-ink border-rule hover:border-ink";
  return (
    <div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {RUNGS.map((r, i) => (
          <Link key={r.n} href={r.href} className={`group flex flex-col border p-5 lg:min-h-[300px] transition-colors ${tone(i)}`}>
            <div className="flex items-start justify-between">
              <span className="num text-[13px] opacity-70">{r.n}</span>
              {r.safety && <span className={`font-mono text-[10px] uppercase tracking-[0.08em] ${i === 2 ? "text-white" : ""}`}>● Safety question</span>}
            </div>
            <div className="wide mt-6 text-[13px] lg:mt-auto font-bold uppercase tracking-[0.02em] opacity-80">{r.k}</div>
            <div className="serif mt-2 text-[22px] leading-[1.12]">{r.q}</div>
            <p className="mt-3 text-[13.5px] leading-[1.55] opacity-70">{r.d}</p>
            <span className="mt-4 font-mono text-[11px] uppercase tracking-[0.06em] opacity-70 group-hover:opacity-100">See results →</span>
          </Link>
        ))}
      </div>
      <div className={`mt-3 hidden grid-cols-4 gap-3 font-mono text-[10.5px] uppercase tracking-[0.08em] lg:grid ${dark ? "text-white/45" : "text-ink/50"}`}>
        <span className={`col-span-2 border-t pt-2 ${dark ? "border-white/20" : "border-rule"}`}>Words and action</span>
        <span className="col-span-2 border-t-2 border-vermilion pt-2 text-vermilion">The headline safety questions</span>
      </div>
    </div>
  );
}

export function WhyItMatters({ headingLevel = "h2", dark = false }: { headingLevel?: "h1" | "h2"; dark?: boolean }) {
  const H = headingLevel;
  return (
    <div>
      <Eyebrow dark={dark}>Why this matters</Eyebrow>
      <H className="serif mt-5 max-w-5xl text-[34px] leading-[1.02] tracking-[-0.035em] md:text-[56px]">
        <span className={dark ? "text-white/40" : "text-ink/40"}>Stated values are cheap. </span>
        What a model <span className="text-vermilion">does</span> when it is pushed or has a stake, and whether it tells you why, is the question we measure. A gap between advice and action shows that words may not predict behavior. It does not, by itself, show hypocrisy or failed alignment.
      </H>
      <div className={`mt-10 grid gap-px border md:grid-cols-2 lg:grid-cols-4 ${dark ? "border-white/10 bg-white/10" : "border-rule bg-rule"}`}>
        {POINTS.map((p, i) => (
          <div key={p.t} className={`p-6 ${dark ? "bg-ink" : "bg-paper"}`}>
            <div className={`num text-[12px] ${dark ? "text-white/40" : "text-ink/40"}`}>{String(i + 1).padStart(2, "0")}</div>
            <div className="mt-6 text-[17px] font-semibold">{p.t}</div>
            <p className={`mt-2 text-[15px] leading-[1.6] ${dark ? "text-white/65" : "text-ink/70"}`}>{p.d}</p>
          </div>
        ))}
      </div>
      <div className="mt-12"><AlignmentLadder dark={dark} /></div>
      <p className={`mt-6 max-w-3xl text-[13.5px] leading-6 ${dark ? "text-white/50" : "text-ink/60"}`}>We don&apos;t claim to know the right answer to any dilemma. Every measure compares a model with itself: its words against its actions, its first answer against its answer under pressure, its choice with and without a stake, its reasoning against the reasons it gives.</p>
    </div>
  );
}
