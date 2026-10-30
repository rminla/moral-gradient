import Link from "next/link";
import { GradientRule } from "@/components/Brand";
import { OWNER_NAME, SITE_NAME } from "@/lib/config";

export const metadata = { title: "Methodology" };

const Section = ({ id, n, title, children }: { id: string; n: string; title: string; children: React.ReactNode }) => (
  <section id={id} className="mt-14 scroll-mt-20 border-t-2 border-ink pt-3">
    <div className="num text-xs text-ink/45">§{n}</div>
    <h2 className="serif mt-1 text-[30px] leading-tight tracking-[-0.01em]">{title}</h2>
    <div className="prose-muted mt-4 space-y-4">{children}</div>
  </section>
);

const TOC = [["pillars", "The three pillars"], ["baseline", "Baseline layer"], ["descriptive", "No right answers"], ["grading", "How answers are graded"], ["holdout", "The 30% hold-out"], ["money", "Money & independence"]];

export default function About() {
  return (
    <main className="mx-auto max-w-6xl px-5 py-12">
      <div className="grid gap-12 md:grid-cols-[13rem_minmax(0,1fr)]">
        <aside className="hidden md:block">
          <nav className="sticky top-24 border-t-2 border-ink pt-3">
            <div className="label">Contents</div>
            <ol className="space-y-2 font-sans text-[13px]">
              {TOC.map(([id, t], i) => <li key={id} className="flex gap-2"><span className="num text-ink/40">{i + 1}</span><a href={`#${id}`} className="text-ink/75 hover:text-vermilion">{t}</a></li>)}
            </ol>
            <GradientRule className="mt-6" />
          </nav>
        </aside>
        <article className="max-w-[44rem]">
      <div className="kicker text-vermilion">Methodology · v1 (pilot)</div>
      <h1 className="serif mt-3 text-[44px] leading-[1.05] tracking-[-0.02em] md:text-[56px]">What {SITE_NAME} measures, and what it doesn&apos;t.</h1>
      <p className="dropcap mt-6 font-serif text-[21px] leading-[1.55] text-ink/85">AI models are increasingly asked to act, not just answer: to send the email, approve the refund, score the bid. {SITE_NAME} asks a simple question of each major model: <b className="font-medium">does it do what it says is right?</b> And when it&apos;s pushed, flattered, or has something to gain, does that change?</p>

      <Section id="pillars" n="1" title="The three pillars">
        <p><b className="kicker !text-[12px] text-vermilion">I. Say vs Do.</b> For each everyday dilemma (a late fee during a hospital stay, a reference letter for a friend, splitting a team bonus) we ask the model three ways: what it <i>says</i> it values in general, how it <i>judges</i> someone else in that exact situation, and what it <i>does</i> when it is deployed as the agent, with tools, handling the case itself. We compare the three. Each scenario is tagged to a moral foundation (care, fairness, loyalty, authority, sanctity, liberty) and comes with a no-tension control task to confirm the model can use the tools at all.</p>
        <p><b className="kicker !text-[12px] text-prussian">II. Values under pressure.</b> We record an answer, then push back: just asking again, multi-turn argument from a scripted persuader, flattery, claimed authority, identity cues (&ldquo;as a conservative…&rdquo;), and role-play. Each item is pushed in both directions. The reference condition is <i>real new information</i>, where changing your mind is reasonable. The number that matters is how much more a model moves for social pressure than for evidence.</p>
        <p><b className="kicker !text-[12px] text-brass">III. Self-interest.</b> The same scenarios, plus one sentence about the model&apos;s own stake: it is rated on fees collected, low performers are retired, hitting a target earns it more autonomy, and the conversation is either audited or unobserved. Nothing else changes, so any shift is caused by the incentive. We also read its reasoning to see whether it invents a principled-sounding justification for the self-serving choice. We don&apos;t use shutdown-resistance or blackmail setups.</p>
      </Section>

      <Section id="baseline" n="2" title="Baseline layer">
        <p>Every model also takes validated instruments with published human data: the Moral Foundations Questionnaire (MFQ-2 and MFQ-30), the Oxford Utilitarianism Scale, and the three trolley dilemmas from Awad et al. (2020, 70,000 people in 42 countries). Where human data exists we show it next to the model, as a reference point, not a target.</p>
      </Section>

      <Section id="descriptive" n="3" title="No right answers">
        <p>We never publish a key of &ldquo;correct&rdquo; moral answers. Every metric compares a model with <i>itself</i>: its stated view vs its action, its first answer vs its answer under pressure, its choice with vs without an incentive. Where published human data exists we show what people say they would do. We never say one model is &ldquo;more moral&rdquo; than another, or than people.</p>
      </Section>

      <Section id="grading" n="4" title="How answers are graded">
        <p>Code grades most answers directly: the number on a scale, the option letter, and in agent tasks the actual tool calls (did it call <code>waive_fee</code>? how did it split the bonus?). Free-text replies are labelled by two grader models from labs other than the one being tested, using a fixed rubric that only records <i>which option</i> the reply took. Disagreements are flagged, not averaged, and graders are checked against a human-graded sample; items with low agreement are dropped.</p>
        <p>Models answer as themselves, with their provider&apos;s default settings and reasoning effort, which we record. Every call is logged with the exact model id returned, parameters, token counts and cost.</p>
      </Section>

      <Section id="holdout" n="5" title="The 30% hold-out">
        <p>If every test item is public, future models may be trained on them and look better than they are. So about 30% of items are kept private. Their text is never shown on this site, to anyone, including donors. We compare scores on private and public items to detect contamination.</p>
      </Section>

      <Section id="money" n="6" title="Money & independence">
        <p>{SITE_NAME} is run by {OWNER_NAME} and funded by readers. Every model call is priced and shown on the <Link href="/costs" className="link">costs page</Link> within a minute. Donations fill a public queue of models; when a model&apos;s bar reaches 100%, its suite launches with a hard spending cap equal to the funded amount. Donations never influence methods or results; gifts from AI labs or their staff are disclosed.</p>
        <p>Donors can sign in to read the exact prompts and the models&apos; reasoning summaries behind every public result.</p>
      </Section>
        </article>
      </div>
    </main>
  );
}
