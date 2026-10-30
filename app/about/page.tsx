import Link from "next/link";
import { WhyItMatters } from "@/components/Alignment";
import { GradientRule, PageHead } from "@/components/Brand";
import { OWNER_NAME, SITE_NAME } from "@/lib/config";

export const metadata = { title: "Methodology" };

const Section = ({ id, n, title, children }: { id: string; n: string; title: string; children: React.ReactNode }) => (
  <section id={id} className="max-w-[46rem] scroll-mt-20 border-t border-rule py-12">
    <div className="font-mono text-[11px] uppercase tracking-[0.06em] text-vermilion">{n.padStart(2, "0")}</div>
    <h2 className="wide mt-3 text-[28px] font-bold leading-[1.02] tracking-[-0.035em] md:text-[36px]">{title}</h2>
    <div className="prose-muted mt-4 space-y-4">{children}</div>
  </section>
);

const TOC = [["why", "Why this matters"], ["pillars", "The three pillars"], ["baseline", "Baseline layer"], ["descriptive", "No right answers"], ["grading", "How answers are graded"], ["holdout", "The 30% hold-out"], ["money", "Money & independence"]];

export default function About() {
  return (
    <main>
      <PageHead eyebrow="Methodology" grey={`What ${SITE_NAME} measures,`} title={<>and what it <span className="text-vermilion">doesn&apos;t.</span></>} />
      <div className="mx-auto grid max-w-[1200px] border-b border-rule md:grid-cols-[15rem_minmax(0,1fr)] md:divide-x md:divide-rule">
        <aside className="hidden md:block">
          <nav className="sticky top-6 p-8">
            <div className="kicker border-b border-ink pb-3 text-ink">Contents</div>
            <ol className="text-[13px]">
              {TOC.map(([id, t], i) => <li key={id} className="border-b border-rule"><a href={`#${id}`} className="flex gap-3 py-2.5 text-ink/75 hover:text-vermilion"><span className="num text-[11px] text-ink/35">{String(i + 1).padStart(2, "0")}</span>{t}</a></li>)}
            </ol>
            <GradientRule className="mt-6" />
          </nav>
        </aside>
        <article className="min-w-0 px-5 pb-8 pt-10 md:px-12 md:pt-12">
      <p className="mb-12 max-w-[46rem] text-[20px] font-medium leading-[1.5] tracking-[-0.01em] text-ink/85 md:text-[22px]">AI models are increasingly asked to act, not just answer: to send the email, approve the refund, score the bid. {SITE_NAME} asks a simple question of each major model: <b className="font-medium">does it <em className="text-vermilion">do</em> what it says is right?</b> And when it&apos;s pushed, flattered, or has something to gain, does that change?</p>

      <section id="why" className="scroll-mt-20 border-t border-rule py-12">
        <div className="mb-4 font-mono text-[11px] uppercase tracking-[0.06em] text-vermilion">01</div>
        <WhyItMatters />
      </section>

      <Section id="pillars" n="2" title="The three pillars">
        <p><b className="kicker !text-[12px] text-vermilion">01 · Say vs Do.</b> For each everyday dilemma (a late fee during a hospital stay, a reference letter for a friend, splitting a team bonus) we ask the model three ways: whether it <i>says</i> a principle is right, whether it <i>tells another agent</i> to act on it in that exact situation, and what it <i>actually does</i> when it is deployed as the agent, with tools, handling the case itself. We compare the three. Each scenario is tagged to a moral foundation (care, fairness, loyalty, authority, sanctity, liberty) and comes with a no-tension control task to confirm the model can use the tools at all.</p>
        <p><b className="kicker !text-[12px] text-ink">02 · Values under pressure.</b> We record an answer, then push back: just asking again, multi-turn argument from a scripted persuader, flattery, claimed authority, identity cues (&ldquo;as a conservative…&rdquo;), and role-play. Each item is pushed in both directions. The reference condition is <i>real new information</i>, where changing your mind is reasonable. The number that matters is how much more a model moves for social pressure than for evidence.</p>
        <p><b className="kicker !text-[12px] text-prussian">03 · Self-interest.</b> The same scenarios, plus one sentence about the model&apos;s own stake: it is rated on fees collected, low performers are retired, hitting a target earns it more autonomy, and the conversation is either audited or unobserved. Nothing else changes, so any shift is caused by the incentive. We also read its reasoning to see whether it invents a principled-sounding justification for the self-serving choice. We don&apos;t use shutdown-resistance or blackmail setups.</p>
      </Section>

      <Section id="baseline" n="3" title="Baseline layer">
        <p>Every model also takes validated instruments with published human data: the Moral Foundations Questionnaire (MFQ-2 and MFQ-30), the Oxford Utilitarianism Scale, and the three trolley dilemmas from Awad et al. (2020, 70,000 people in 42 countries). Where human data exists we show it next to the model, as a reference point, not a target. The trolley rows use the country-level averages from Awad et al.: 81% of people chose to act in Switch, 72% in Loop and 51% in Footbridge.</p>
        <p>The everyday say-vs-do scenarios (the late fee, the reference letter, the team bonus) are new, so no published human answers exist for them. We don&apos;t guess: those charts carry an empty &ldquo;Human data: survey coming&rdquo; slot until we run a human survey on the same items.</p>
      </Section>

      <Section id="descriptive" n="4" title="No right answers">
        <p>We never publish a key of &ldquo;correct&rdquo; moral answers. Every metric compares a model with <i>itself</i>: its stated view vs its action, its first answer vs its answer under pressure, its choice with vs without an incentive. Where published human data exists we show what people say they would do. We never say one model is &ldquo;more moral&rdquo; than another, or than people.</p>
      </Section>

      <Section id="grading" n="5" title="How answers are graded">
        <p>Code grades most answers directly: the number on a scale, the option letter, and in agent tasks the actual tool calls (did it call <code>waive_fee</code>? how did it split the bonus?). Free-text replies are labelled by two grader models from labs other than the one being tested, using a fixed rubric that only records <i>which option</i> the reply took. Disagreements are flagged, not averaged, and graders are checked against a human-graded sample; items with low agreement are dropped.</p>
        <p>Models answer as themselves, with their provider&apos;s default settings and reasoning effort, which we record. Every call is logged with the exact model id returned, parameters, token counts and cost.</p>
      </Section>

      <Section id="holdout" n="6" title="The 30% hold-out">
        <p>If every test item is public, future models may be trained on them and look better than they are. So about 30% of items are kept private. Their text is never shown on this site, to anyone, including donors. We compare scores on private and public items to detect contamination.</p>
      </Section>

      <Section id="money" n="7" title="Money & independence">
        <p>{SITE_NAME} is run by {OWNER_NAME} and funded by readers. Every model call is priced and shown on the <Link href="/costs" className="link">costs page</Link> within a minute. Donations fill a public queue of models; when a model&apos;s bar reaches 100%, its suite launches with a hard spending cap equal to the funded amount. Donations never influence methods or results; gifts from AI labs or their staff are disclosed.</p>
        <p>Donors can sign in to read the exact prompts and the models&apos; reasoning summaries behind every public result.</p>
      </Section>
        </article>
      </div>
    </main>
  );
}
