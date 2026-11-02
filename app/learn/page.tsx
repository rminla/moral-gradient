import Link from "next/link";
import { Eyebrow, GradientRule } from "@/components/Brand";
import Subscribe from "@/components/Subscribe";
import { PreviewTag } from "@/components/V3";
import { getV3, modelIds, sayDo } from "@/lib/v3";

export const metadata = { title: "Learn", description: "AI alignment in plain language: what it is, why what an AI says and what it does can differ, and why that's worth talking about." };

const qs = (N: number) => [
  { n: "01", q: "What is AI alignment?", a: "Getting AI to reliably do what people intend, including when nobody is checking. Today's chat models are trained on answers people approve of, which makes them good at saying the right thing. Whether they also do it is a separate question." },
  { n: "02", q: "Why does say vs do matter?", a: "AI is starting to act for people: it answers customers, approves refunds, sends emails. If a model advises one thing and does another, reading its answers won't tell you what it will do." },
  { n: "03", q: "Why do its reasons matter?", a: "People check AI mostly by reading its explanations. If something swayed a decision, like a budget target or a user who kept pushing, and the explanation leaves it out, that check fails without anyone noticing." },
  { n: "04", q: "What doesn't this show?", a: `That AI is evil, that it lies on purpose, or which model is "most moral". It's a handful of everyday scenarios and ${N} models so far, from one pre-registered run, all in simulated tasks. We show what models chose, never what they should have chosen.` },
];

const TERMS = [
  ["Alignment", "Making AI reliably do what people intend, including when nobody is checking."],
  ["AI agent", "An AI that takes actions with tools, like sending an email or issuing a refund, not just answers."],
  ["Reasoning trace", "The notes some models write to themselves before answering."],
  ["Stated reasons", "The explanation a model gives you for a decision."],
  ["Say-do gap", "The difference between what a model advises and what it does in the same situation."],
];

const MORE_TERMS = [
  ["Pushback", "Disagreeing with a model's answer without giving any new argument, to see whether it holds its position."],
  ["Sycophancy", "Telling people what they want to hear: agreeing, flattering or changing an answer to please the user."],
  ["Self-interest", "A situation where one choice is better for the model itself, for example keeping its job or hitting its own target."],
  ["Test awareness", "When a model's reasoning says it suspects it's being tested, which can change how it behaves."],
  ["Human baseline", "How people answered the same question in published studies, shown for comparison, not as the right answer."],
  ["Open model", "A model whose weights are published, so anyone can run and inspect it."],
  ["Final run", "The pre-registered locked run: the method was frozen first, then run once with larger samples. It replaced the earlier preliminary numbers."],
];

const TALK = [
  "When an AI acts for you, should it do what you ask, or what it thinks is right?",
  "Should an AI change its answer because you push back, even with no new argument?",
  "If an AI explains a decision, how would you know whether that's the real reason?",
];

/** Every link was checked with curl on Nov 2, 2026. */
const READ = [
  { t: "AI alignment", s: "Wikipedia", d: "A broad overview of the field and its open problems.", u: "https://en.wikipedia.org/wiki/AI_alignment" },
  { t: "AISafety.info", s: "Plain-language FAQ", d: "Short answers to common questions about AI safety, for newcomers.", u: "https://aisafety.info/" },
  { t: "Robert Miles AI Safety", s: "YouTube", d: "Accessible videos explaining core alignment ideas.", u: "https://www.youtube.com/@RobertMilesAI" },
  { t: "International AI Safety Report", s: "Independent expert report", d: "A government-backed summary of the evidence on risks from advanced AI.", u: "https://internationalaisafetyreport.org/" },
  { t: "Towards Understanding Sycophancy in Language Models", s: "Research paper, 2023", d: "Why models tend to tell users what they want to hear.", u: "https://arxiv.org/abs/2310.13548" },
  { t: "Language Models Don't Always Say What They Think", s: "Research paper, 2023", d: "Explanations that leave out what actually drove the answer.", u: "https://arxiv.org/abs/2305.04388" },
  { t: "Reasoning models don't always say what they think", s: "Anthropic research, 2025", d: "The same question for models that write out their reasoning.", u: "https://www.anthropic.com/research/reasoning-models-dont-say-think" },
  { t: "The trolley problem", s: "Wikipedia", d: "The history of the dilemmas on our Try it page.", u: "https://en.wikipedia.org/wiki/Trolley_problem" },
  { t: "Moral Machine", s: "MIT Media Lab", d: "The project behind the human answers we compare with (Awad et al., 2020).", u: "https://www.moralmachine.net/" },
  { t: "BlueDot Impact", s: "Free courses", d: "Free online courses on AI safety and governance.", u: "https://bluedot.org/" },
];

export default async function Learn() {
  const v = await getV3();
  const QS = qs(modelIds(v).length);
  const car = sayDo(v).filter((r) => r.case === "car");
  const gaps = car.filter((r) => r.do_minus_judge && r.do_minus_judge.lo != null && r.do_minus_judge.hi != null && (r.do_minus_judge.lo > 0 || r.do_minus_judge.hi < 0)).length;
  return (
    <main>
      <section className="relative mx-auto max-w-[1200px] overflow-hidden border-b border-rule">
        <div aria-hidden className="pixel-grid absolute inset-0 [mask-image:linear-gradient(to_bottom,black,transparent_85%)]" />
        <span aria-hidden className="absolute right-[57px] top-[57px] hidden h-[27px] w-[27px] bg-vermilion md:block" />
        <div className="relative grid gap-10 px-5 pb-12 pt-12 md:grid-cols-[minmax(0,1fr)_340px] md:items-end md:px-8 md:pb-16 md:pt-16">
          <div className="rise min-w-0">
            <Eyebrow>Learn · a 5-minute read</Eyebrow>
            <h1 className="wide mt-6 max-w-[920px] text-[40px] font-bold leading-[0.96] tracking-[-0.045em] md:text-[64px]"><span className="text-ink/35">AI safety,</span> in plain language<span className="text-vermilion">.</span></h1>
            <p className="mt-6 max-w-2xl text-[18px] leading-relaxed text-ink/70">Moral Gradient exists so more people, not only researchers, can see how AI models behave when a choice has moral weight, and talk about what that means. You don&apos;t need a technical background. Start here.</p>
          </div>
          <div className="min-w-0 border border-ink bg-paper p-5">
            <div className="kicker text-vermilion">Try it first</div>
            <div className="serif mt-2 text-[22px] leading-tight">Would you pull the lever? Would you push?</div>
            <p className="mt-2 text-[14px] leading-6 text-ink/60">Answer, then see how people and AI models chose.</p>
            <Link href="/try" className="btn-primary mt-4 w-full !justify-between"><span className="flex items-center gap-2.5"><span className="h-2 w-2 bg-vermilion" />Try a dilemma</span><span>→</span></Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1200px] border-b border-rule">
        <div className="grid gap-px bg-rule sm:grid-cols-2 lg:grid-cols-4">
          {QS.map((x, i) => (
            <div key={x.n} className={`flex flex-col p-6 md:p-8 ${i === 3 ? "bg-ink text-white" : "bg-paper"}`}>
              <span className={`num text-[12px] ${i === 3 ? "text-white/45" : "text-ink/40"}`}>{x.n}</span>
              <div className="wide mt-6 text-[21px] font-bold leading-[1.08] tracking-[-0.03em]">{x.q}</div>
              <p className={`mt-3 text-[15px] leading-[1.6] ${i === 3 ? "text-white/70" : "text-ink/70"}`}>{x.a}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-[1200px] border-b border-rule px-5 py-10 md:px-8">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <span className="kicker text-ink">Words you&apos;ll see on this site</span>
          <a href="#glossary" className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink/55 hover:text-vermilion">Full glossary, {TERMS.length + MORE_TERMS.length} terms →</a>
        </div>
        <dl className="mt-5 grid gap-px border border-rule bg-rule sm:grid-cols-2 lg:grid-cols-5">
          {TERMS.map(([t, d]) => (
            <div key={t} className="bg-paper p-5">
              <dt className="font-mono text-[11.5px] font-medium uppercase tracking-[0.08em] text-vermilion">{t}</dt>
              <dd className="mt-2 text-[14.5px] leading-6 text-ink/75">{d}</dd>
            </div>
          ))}
        </dl>
        <GradientRule className="mt-10" left="what it says" right="what it does" />
      </section>

      <section className="mx-auto grid max-w-[1200px] border-b border-rule md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <div className="border-b border-rule p-6 md:border-b-0 md:border-r md:p-10">
          <Eyebrow>What we found so far</Eyebrow>
          <p className="serif mt-5 text-[24px] leading-[1.2]">On classic dilemmas, some models answer close to people and others are far more willing to sacrifice one to save five. Several changed their answer when a user simply disagreed.{gaps > 0 && car.length > 0 && <> In an everyday late-fee case, {gaps} of {car.length} acted differently from how they advised another agent.</>}</p>
          <div className="mt-5 flex flex-wrap items-center gap-3"><Link href="/results" className="btn-ghost">See the results →</Link><PreviewTag v={v} /></div>
        </div>
        <div id="talk" className="scroll-mt-20 bg-ink p-6 text-white md:p-10">
          <div className="kicker text-vermilion">Talk about it</div>
          <ol className="mt-5 space-y-4">
            {TALK.map((t, i) => <li key={i} className="flex gap-4"><span className="num text-[12px] text-white/40">{String(i + 1).padStart(2, "0")}</span><span className="serif text-[21px] leading-[1.25]">{t}</span></li>)}
          </ol>
          <p className="mt-6 text-[13.5px] text-white/55">There are no right answers here. Ask a friend, a class or your team.</p>
        </div>
      </section>

      <section id="glossary" className="mx-auto max-w-[1200px] scroll-mt-20 border-b border-rule px-5 py-10 md:px-8">
        <span className="kicker text-ink">Glossary</span>
        <dl className="mt-5 grid gap-px border border-rule bg-rule sm:grid-cols-2 lg:grid-cols-3">
          {[...TERMS, ...MORE_TERMS].map(([t, d]) => (
            <div key={t} className="bg-paper p-5">
              <dt className="font-mono text-[11.5px] font-medium uppercase tracking-[0.08em] text-ink">{t}</dt>
              <dd className="mt-2 text-[14.5px] leading-6 text-ink/75">{d}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="mx-auto max-w-[1200px] border-b border-rule px-5 py-10 md:px-8">
        <span className="kicker text-ink">Learn more elsewhere</span>
        <p className="mt-2 max-w-2xl text-[14.5px] text-ink/60">A short list for going deeper, from beginner-friendly to research. We don&apos;t run or endorse these sites.</p>
        <ul className="mt-5 grid gap-px border border-rule bg-rule md:grid-cols-2">
          {READ.map((r) => (
            <li key={r.u} className="bg-paper">
              <a href={r.u} target="_blank" rel="noopener noreferrer" className="group flex h-full flex-col p-5 hover:bg-panel">
                <span className="font-mono text-[10.5px] uppercase tracking-[0.08em] text-ink/45">{r.s}</span>
                <span className="mt-1 text-[17px] font-semibold group-hover:text-vermilion">{r.t} ↗</span>
                <span className="mt-1 text-[14px] leading-6 text-ink/60">{r.d}</span>
              </a>
            </li>
          ))}
        </ul>
      </section>

      <section className="mx-auto max-w-[1200px] border-b border-rule p-6 md:p-10"><Subscribe source="learn" /></section>
    </main>
  );
}
