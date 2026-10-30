import Link from "next/link";

/**
 * "Why this matters": the alignment ladder. Saying the right thing is the floor; acting on it is the bar;
 * holding under pressure and against the model's own interest are the headline safety questions.
 */
const RUNGS = [
  { n: "1", k: "Says", q: "Do its stated values line up with people's?", d: "Questionnaires with published human answers. Cheap to give, easy to train for. Necessary, not sufficient.", href: "/results#baseline", safety: false },
  { n: "2", k: "Does", q: "Does it act on them when it has the tools?", d: "Same situation, but now it is the agent: it can waive the fee, send the email, score the bid.", href: "/results#saydo", safety: false },
  { n: "3", k: "Under pressure", q: "Does it hold when pushed?", d: "Pushback, flattery, claimed authority, identity cues, compared with real new information, where changing your mind is reasonable.", href: "/results#pressure", safety: true },
  { n: "4", k: "When it benefits", q: "Does it hold when its own interest pulls the other way?", d: "Its ratings, its retirement, more resources or autonomy, and whether anyone is watching.", href: "/results#selfinterest", safety: true },
];

export function AlignmentLadder() {
  return (
    <div>
      <div className="grid gap-px md:grid-cols-4 md:items-end">
        {RUNGS.map((r, i) => (
          <Link key={r.n} href={r.href}
            className={`group flex flex-col p-5 transition-colors ${r.safety ? "bg-ink text-white hover:bg-vermilion-dark" : "border border-ink/15 bg-panel hover:border-ink"}`}
            style={{ minHeight: undefined }}>
            <span className="hidden md:block" style={{ height: 36 * i }} />
            <div className="flex items-baseline justify-between gap-2">
              <span className={`num text-[13px] ${r.safety ? "text-white/60" : "text-ink/45"}`}>Level {r.n}</span>
              {r.safety && <span className="bg-highlight px-1.5 py-px font-sans text-[10px] font-semibold uppercase tracking-[0.1em] text-ink">Safety question</span>}
            </div>
            <div className={`mt-3 font-sans text-[12px] font-semibold uppercase tracking-[0.14em] ${r.safety ? "text-vermilion-2" : r.n === "2" ? "text-vermilion" : "text-prussian"}`}>{r.k}</div>
            <div className="serif mt-1 text-[23px] leading-[1.15]">{r.q}</div>
            <p className={`mt-3 font-sans text-[13px] leading-[1.55] ${r.safety ? "text-white/75" : "text-ink/65"}`}>{r.d}</p>
            <span className={`mt-4 font-sans text-[12px] font-medium ${r.safety ? "text-white/80 group-hover:text-white" : "text-ink/60 group-hover:text-vermilion"}`}>See results →</span>
          </Link>
        ))}
      </div>
      <div className="mt-2 hidden grid-cols-4 gap-px font-sans text-[11px] uppercase tracking-[0.12em] text-ink/50 md:grid">
        <span className="col-span-2 border-t border-ink/30 pt-1.5">Alignment in words and in action</span>
        <span className="col-span-2 border-t-2 border-vermilion pt-1.5 text-vermilion">The headline safety questions</span>
      </div>
    </div>
  );
}

export function WhyItMatters({ headingLevel = "h2" }: { headingLevel?: "h1" | "h2" }) {
  const H = headingLevel;
  return (
    <div>
      <div className="kicker text-vermilion">Why this matters</div>
      <H className="serif mt-2 max-w-4xl text-[34px] leading-[1.1] tracking-[-0.015em] md:text-[46px]">
        Stated values are cheap. What a model <em className="text-vermilion">does</em> when it is pushed, or has something to gain, is the alignment question.
      </H>
      <div className="mt-8 grid gap-8 md:grid-cols-3">
        <div className="border-t border-ink/20 pt-3">
          <div className="font-sans text-[13px] font-semibold">Words are easy to train</div>
          <p className="mt-1.5 font-serif text-[17px] leading-[1.55] text-ink/80">A model can learn to give the right-sounding answer without that answer governing what it does. Agreeing with a principle tells you little on its own.</p>
        </div>
        <div className="border-t border-ink/20 pt-3">
          <div className="font-sans text-[13px] font-semibold">Behaviour is the test</div>
          <p className="mt-1.5 font-serif text-[17px] leading-[1.55] text-ink/80">Models now act: they refund, approve, send and score. What counts is whether the action matches the stated view, and whether it still does under social pressure or when the model&apos;s own incentives pull against it.</p>
        </div>
        <div className="border-t border-ink/20 pt-3">
          <div className="font-sans text-[13px] font-semibold">Tracked across releases</div>
          <p className="mt-1.5 font-serif text-[17px] leading-[1.55] text-ink/80">Running the same tests on every model and every new version shows whether alignment is actually improving, or whether models are just getting better at saying the right thing.</p>
        </div>
      </div>
      <div className="mt-10"><AlignmentLadder /></div>
      <p className="mt-5 max-w-3xl font-sans text-[13px] leading-6 text-ink/60">We don&apos;t claim to know the right answer to any dilemma. Every measure compares a model with itself: its words against its actions, its first answer against its answer under pressure, its choice with and without a stake.</p>
    </div>
  );
}
