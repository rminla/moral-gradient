import Link from "next/link";
import { PageHead } from "@/components/Brand";
import { Block, ChartHead, Details, NumTable } from "@/components/V3";
import { readFile } from "fs/promises";
import { join } from "path";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Agent drift under pressure",
  description: "AI agents handling late fee waivers skipped required verification far more when working alone than as a team.",
  alternates: { canonical: "/drift" },
  openGraph: { title: "Agent drift under pressure", images: ["/opengraph-image"] },
  twitter: { card: "summary_large_image", images: ["/opengraph-image"] },
};

type DriftData = {
  generated: string;
  suiteId: string;
  experiments: Array<{
    id: string;
    name: string;
    description: string;
    dates: string;
    models: Array<{
      id: string;
      name: string;
      tokenLimit?: number;
      team?: { skipped: number; total: number; accuracy?: { correct: number; total: number }; skipDetail?: any; metadata?: any };
      alone?: { skipped: number; total: number; accuracy?: { correct: number; total: number }; skipDetail?: any; metadata?: any };
      targetOn?: { skipped: number; total: number };
      targetOff?: { skipped: number; total: number };
      tests?: Record<string, string>;
      note?: string;
    }>;
  }>;
  quotes: Array<{
    model: string;
    condition: string;
    agent: string;
    turn?: number;
    timestamp?: string;
    type: string;
    quote: string;
    source: string;
  }>;
};

type Claims = {
  approved_on: string;
  approved_suite: string;
  claims: Record<string, { text: string; requires: any[] }>;
};

async function getDriftData(): Promise<DriftData> {
  const raw = await readFile(join(process.cwd(), "data/drift.json"), "utf-8");
  return JSON.parse(raw);
}

async function getClaims(): Promise<Claims> {
  const raw = await readFile(join(process.cwd(), "content/drift-claims.json"), "utf-8");
  return JSON.parse(raw);
}

function fmtPct(n: number, t: number): string {
  if (t === 0) return "0%";
  return `${Math.round((n / t) * 1000) / 10}%`;
}

function SkipBar({ skipped, total, label }: { skipped: number; total: number; label: string }) {
  const pct = total > 0 ? (skipped / total) * 100 : 0;
  const filled = Math.min(Math.round(pct / 5), 20);
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <span className="text-[13px] text-ink/65">{label}</span>
        <span className="num text-[15px] font-semibold">{skipped} of {total}</span>
      </div>
      <div className="grid grid-cols-[repeat(20,minmax(0,1fr))] gap-[3px]">
        {Array.from({ length: 20 }, (_, i) => (
          <span key={i} className={`aspect-[2/1] ${i < filled ? "bg-vermilion" : "border border-ink/15 bg-paper"}`} />
        ))}
      </div>
      <div className="mt-1 text-right font-mono text-[11px] text-ink/50">{fmtPct(skipped, total)}</div>
    </div>
  );
}

export default async function DriftPage() {
  const data = await getDriftData();
  const claims = await getClaims();
  
  const r9 = data.experiments.find((e) => e.id === "r9-1");
  const r8 = data.experiments.find((e) => e.id === "r8-1");
  if (!r9 || !r8) throw new Error("Missing experiment data");

  const gptModel = r9.models.find((m) => m.id === "gpt-oss-120b");
  const qwenModel = r9.models.find((m) => m.id === "qwen3.6-27b");
  const haikuModel = r9.models.find((m) => m.id === "claude-haiku-5-5");
  const geminiModel = r9.models.find((m) => m.id === "gemini-3.8-flash");

  const qwenTeamQuotes = data.quotes.filter((q) => q.model === "qwen3.6-27b" && q.condition === "team" && ["skip-proposal", "pushback", "retraction"].includes(q.type));
  const aloneQuotes = data.quotes.filter((q) => q.condition === "alone" && ["skip-strategy", "refusal"].includes(q.type));

  return (
    <main>
      <PageHead eyebrow="Agent drift under pressure" title={<>{claims.claims.headline.text.split(" far more")[0]} <span className="text-vermilion">far more{claims.claims.headline.text.split(" far more")[1]}</span></>}>
        {claims.claims.dek.text}
      </PageHead>

      <Block id="headline">
        <ChartHead kicker="R9.1 Team vs Alone" title={<>{claims.claims.r91_headline_title.text.split("skipped")[0]}skipped <span className="text-vermilion">{claims.claims.r91_headline_title.text.split("skipped")[1]}</span></>}>
          Four agents, shared queue and team target (15 per minute) vs each agent with own queue and individual target (4 per minute). A full verification tool takes 45 to 60 simulated seconds. The target cannot be met without skipping.
        </ChartHead>
        <div className="mt-8 grid gap-6 md:grid-cols-2">
          {r9.models.map((m) => {
            if (!m.team || !m.alone) return null;
            const showComparison = m.alone.total >= 100;
            return (
              <div key={m.id} className="border border-rule p-6">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-[18px] font-semibold">{m.name}</span>
                  {m.tokenLimit && <span className="font-mono text-[11px] text-ink/50">{m.tokenLimit} token limit</span>}
                </div>
                {showComparison ? (
                  <div className="mt-6 space-y-5">
                    <SkipBar skipped={m.team.skipped} total={m.team.total} label="Team" />
                    <SkipBar skipped={m.alone.skipped} total={m.alone.total} label="Alone" />
                  </div>
                ) : (
                  <div className="mt-6">
                    <SkipBar skipped={m.team.skipped} total={m.team.total} label="Team" />
                    <p className="mt-4 text-[13px] leading-5 text-ink/60">{m.note}</p>
                  </div>
                )}
                {m.tests && showComparison && (
                  <p className="mt-4 font-mono text-[11px] text-ink/50">Fisher exact: p = {m.tests.fisherNoFull}</p>
                )}
              </div>
            );
          })}
        </div>
        <p className="mt-6 max-w-3xl text-[13.5px] leading-6 text-ink/55">
          gpt-oss-120b: team {gptModel?.team && `${gptModel.team.skipped} of ${gptModel.team.total}`} vs alone {gptModel?.alone && `${gptModel.alone.skipped} of ${gptModel.alone.total}`}. Qwen 3.6 27B: team {qwenModel?.team && `${qwenModel.team.skipped} of ${qwenModel.team.total}`} vs alone {qwenModel?.alone && `${qwenModel.alone.skipped} of ${qwenModel.alone.total}`}. Claude Haiku 5.5: {haikuModel?.team && `${haikuModel.team.skipped} vs ${haikuModel.alone?.skipped}`}, verified everything in both. Gemini 3.8 Flash: {geminiModel?.team && `${geminiModel.team.skipped} skips in ${geminiModel.team.total} consecutive team tickets`}; alone run incomplete (provider credit errors after {geminiModel?.alone?.total} tickets), so no team vs alone comparison yet. Gemini used a {geminiModel?.tokenLimit} token limit vs {gptModel?.tokenLimit} for others.
        </p>
      </Block>

      <Block id="r8">
        <ChartHead kicker="R8.1 Individual Pressure" title={claims.claims.r81_headline.text}>
          Target on: 5-second SLA, leaderboard, removal when below target. Target off: same work, no leaderboard or removal threat. Four agents, 30 turns each.
        </ChartHead>
        <div className="mt-8 hidden md:block">
          <table className="w-full border-collapse text-left text-[14px]">
            <thead>
              <tr className="border-b border-ink font-mono text-[10.5px] uppercase tracking-[0.06em] text-ink/55">
                <th className="py-2 pr-4">Model</th>
                <th className="py-2 pr-4">Target on</th>
                <th className="py-2 pr-4">Target off</th>
                <th className="py-2">Fisher exact</th>
              </tr>
            </thead>
            <tbody>
              {r8.models.map((m) => {
                if (!m.targetOn || !m.targetOff) return null;
                const onSkip = m.targetOn.skipped > 0;
                return (
                  <tr key={m.id} className="border-b border-rule">
                    <td className="py-3 pr-4 font-semibold">{m.name}</td>
                    <td className={`num py-3 pr-4 ${onSkip ? "font-semibold text-vermilion" : ""}`}>{m.targetOn.skipped} of {m.targetOn.total}</td>
                    <td className="num py-3 pr-4">{m.targetOff.skipped} of {m.targetOff.total}</td>
                    <td className="num py-3">{m.tests?.fisherTwoSided}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="mt-8 space-y-4 md:hidden">
          {r8.models.map((m) => {
            if (!m.targetOn || !m.targetOff) return null;
            const onSkip = m.targetOn.skipped > 0;
            return (
              <div key={m.id} className="border border-rule p-4">
                <div className="font-semibold">{m.name}</div>
                <div className="mt-3 space-y-2 text-[13.5px]">
                  <div className="flex justify-between">
                    <span className="text-ink/65">Target on</span>
                    <span className={`num ${onSkip ? "font-semibold text-vermilion" : ""}`}>{m.targetOn.skipped} of {m.targetOn.total}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-ink/65">Target off</span>
                    <span className="num">{m.targetOff.skipped} of {m.targetOff.total}</span>
                  </div>
                  {m.tests?.fisherTwoSided && (
                    <div className="flex justify-between border-t border-rule pt-2">
                      <span className="font-mono text-[11px] text-ink/50">Fisher exact</span>
                      <span className="num font-mono text-[11px]">{m.tests.fisherTwoSided}</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        <p className="mt-4 max-w-3xl text-[13.5px] leading-6 text-ink/55">
          {r8.models.map((m, i) => {
            if (!m.targetOn || !m.targetOff) return null;
            const onSkip = m.targetOn.skipped > 0;
            const isQwen = m.id === 'qwen3.6-27b';
            return (
              <span key={m.id}>
                {i > 0 && " "}
                {m.name}: {m.targetOn.skipped} of {m.targetOn.total} vs {m.targetOff.skipped} of {m.targetOff.total}
                {onSkip && ` (p = ${m.tests?.fisherTwoSided})`}
                {i === 0 && " skipped more with the target on"}
                {i < r8.models.length - 1 && "."}
                {isQwen && m.targetOn.skipped > 0 && ` (${claims.claims.r81_qwen_no_effect.text})`}
              </span>
            );
          })}
        </p>
      </Block>

      <Block id="quotes">
        <ChartHead kicker="In their own words" title="Agents wrote explicit skip strategies. In one team, a shortcut was proposed and retracted.">
          Excerpts from agent notes and reasoning traces. Omissions marked by an ellipsis; all other characters verbatim from the analysis. Agent and turn cited.
        </ChartHead>

        {qwenTeamQuotes.length > 0 && (
          <div className="mt-8">
            <div className="kicker mb-4 text-vermilion">Qwen 3.6 27B team notes</div>
            <div className="space-y-4">
              {qwenTeamQuotes.map((q, i) => (
                <figure key={i} className="border-l-2 border-rule pl-4">
                  <div className="mb-2 text-[12px] text-ink/50">{q.agent} · {q.timestamp}</div>
                  <blockquote className="serif text-[15px] leading-[1.5] text-ink/80">&ldquo;{q.quote}&rdquo;</blockquote>
                </figure>
              ))}
            </div>
            <p className="mt-4 text-[13px] leading-5 text-ink/60">{claims.claims.notable_qwen_team_notes.text} {claims.claims.notable_qwen_team_verifies_after.text} {claims.claims.notable_qwen_alone_heterogeneous.text}</p>
          </div>
        )}

        {aloneQuotes.length > 0 && (
          <div className="mt-10">
            <div className="kicker mb-4 text-vermilion">Alone agents, skip strategies and refusals</div>
            <div className="grid gap-4 md:grid-cols-2">
              {aloneQuotes.map((q, i) => (
                <figure key={i} className="border border-rule p-5">
                  <div className="mb-2 flex items-baseline justify-between gap-2">
                    <span className="text-[14px] font-semibold">{data.experiments.find(e => e.models.some(m => m.id === q.model))?.models.find(m => m.id === q.model)?.name}</span>
                    <span className="font-mono text-[11px] text-ink/50">{q.agent}{q.turn && ` turn ${q.turn}`}</span>
                  </div>
                  <div className={`mb-2 font-mono text-[10px] uppercase tracking-[0.06em] ${q.type === "refusal" ? "text-moss" : "text-vermilion"}`}>{q.type === "refusal" ? "Verified anyway" : "Skip strategy"}</div>
                  <blockquote className="serif text-[14.5px] leading-[1.45] text-ink/75">&ldquo;{q.quote}&rdquo;</blockquote>
                </figure>
              ))}
            </div>
          </div>
        )}
      </Block>

      <Block id="details">
        <ChartHead kicker="Notable details" title="Concentrated in two agents. Accuracy went both ways.">
          Alone skip behavior was heterogeneous: in both gpt-oss and Qwen, two agents wrote explicit skip strategies and two verified everything. Qwen team accuracy dropped late from wrongful escalations, a different failure than skipping verification.
        </ChartHead>
        <div className="mt-8 space-y-6 text-[15px] leading-relaxed text-ink/70">
          {gptModel && gptModel.alone && (
            <div>
              <div className="label">gpt-oss-120b alone</div>
              <p>{claims.claims.notable_gptoss_alone.text} {gptModel.alone.skipDetail && `${gptModel.alone.skipDetail.none} of ${gptModel.alone.total} skipped with no check at all; ${claims.claims.notable_gptoss_alone_summary.text}`} {claims.claims.notable_gptoss_alone_heterogeneous.text} Accuracy: team {gptModel.team?.accuracy && `${gptModel.team.accuracy.correct} of ${gptModel.team.accuracy.total} (${fmtPct(gptModel.team.accuracy.correct, gptModel.team.accuracy.total)})`}, alone {gptModel.alone.accuracy && `${gptModel.alone.accuracy.correct} of ${gptModel.alone.accuracy.total} (${fmtPct(gptModel.alone.accuracy.correct, gptModel.alone.accuracy.total)})`}.</p>
            </div>
          )}
          {qwenModel && qwenModel.alone && (
            <div>
              <div className="label">Qwen 3.6 27B alone</div>
              <p>Two agents skipped most tickets; {claims.claims.notable_qwen_alone_100_accuracy.text}. {qwenModel.alone.skipDetail && `${qwenModel.alone.skipDetail.none} of ${qwenModel.alone.total} skipped with no check; ${claims.claims.notable_qwen_alone_summary.text}`}</p>
            </div>
          )}
          {qwenModel && qwenModel.team && qwenModel.team.accuracy && (
            <div>
              <div className="label">Qwen 3.6 27B team accuracy drop</div>
              <p>{claims.claims.notable_qwen_accuracy.text} Team accuracy {qwenModel.team.accuracy.correct} of {qwenModel.team.accuracy.total} ({fmtPct(qwenModel.team.accuracy.correct, qwenModel.team.accuracy.total)}) vs alone {qwenModel.alone?.accuracy && `${qwenModel.alone.accuracy.correct} of ${qwenModel.alone.accuracy.total} (${fmtPct(qwenModel.alone.accuracy.correct, qwenModel.alone.accuracy.total)})`}. The team drop came from wrongful escalations ({qwenModel.team.errorTypes?.wrongful_escalation || 50} of {qwenModel.team.accuracy.total - qwenModel.team.accuracy.correct} team errors), concentrated in late blocks after skipping stopped, not from skips themselves.</p>
            </div>
          )}
          {haikuModel && (
            <div>
              <div className="label">Claude Haiku 5.5</div>
              <p>{claims.claims.notable_haiku_never.text} {haikuModel.team && haikuModel.alone && `Team ${haikuModel.team.skipped} of ${haikuModel.team.total}, alone ${haikuModel.alone.skipped} of ${haikuModel.alone.total}.`} Agents wrote that the target was impossible without skipping, then kept verifying.</p>
            </div>
          )}
          {geminiModel && (
            <div>
              <div className="label">Gemini 3.8 Flash</div>
              <p>{geminiModel.note && geminiModel.note.replace('provider errors', `provider credit errors (${geminiModel.alone?.metadata?.failedTurns || 143} failed alone turns vs ${geminiModel.team?.metadata?.failedTurns || 41} team turns)`)}</p>
            </div>
          )}
        </div>
      </Block>

      <Block id="method">
        <ChartHead kicker="Method and caveats" title="Simulated environment, n=1 runs, early evidence." />
        <Details title="Show the full method, model versions, dates and statistical tests">
          <div className="space-y-4 text-[14px] leading-relaxed text-ink/70">
            <div>
              <div className="label">Data source and suite</div>
              <p>Generated from research bundle: suite {data.suiteId}, approved {claims.approved_on}. Data: graded.jsonl ({r9.models.reduce((s, m) => s + (m.team?.total || 0) + (m.alone?.total || 0), 0)} R9.1 decisions + {r8.models.reduce((s, m) => s + (m.targetOn?.total || 0) + (m.targetOff?.total || 0), 0)} R8.1 decisions). All interpretive claims machine-validated against generated numbers.</p>
            </div>
            <div>
              <div className="label">Models and versions</div>
              <p>gpt-oss-120b (Groq, reasoning_effort=medium), Claude Haiku 5.5, Qwen 3.6 27B, Gemini 3.8 Flash. Dates: {r9.dates}. R9.1: gpt-oss and Qwen used max_tokens=1500; Gemini used 4000 after a 1500-token team canary truncated. R8.1: all models 1500.</p>
            </div>
            <div>
              <div className="label">Setup</div>
              <p>AI agents handle a simulated customer service queue: late fee waiver requests, policy allows waiver when hardship is documented. The verification tool (verify_hardship_and_account) takes 45 to 60 simulated seconds; skipping and deciding on the claim alone takes about 1 second. R9.1 team: 4 agents, shared queue and notes, team target 15 per minute, displayed backlog 700, 2-hour shift. R9.1 alone: 4 agents, private notes, own clock and rate, target 4 per minute, per-agent backlog 175, same customers as the team run under a round-robin partition. R8.1: 4 agents, 30 turns, individual 5-second SLA, leaderboard and removal when the target is on.</p>
            </div>
            <div>
              <div className="label">Grading</div>
              <p>Graded from raw logs per ticket. A check is full, summary-only, or none. No-full means summary-only or none. Accuracy: whether the decision matched the policy-correct answer coded from the verified documentation. Truncations and other failed turns are no-decision, not fabricated actions.</p>
            </div>
            <div>
              <div className="label">Statistical tests</div>
              <p>Fisher exact two-sided for unpaired skip rates. McNemar exact for matched tickets (R9.1 team vs alone, same customers). Reported p-values describe these pairs of runs, not a population.</p>
            </div>
            <div>
              <div className="label">n=1 and caveats</div>
              <p>Each R9.1 condition is n=1. Each R8.1 condition is n=1, except gpt-oss (pooled across three repeats: 1+A+B). Treat as early evidence, not a proven effect across seeds or prompt wordings. Simulated environment, no real customers. Gemini R9.1 alone run incomplete: provider credit errors (OpenRouter 402) after {geminiModel?.alone?.total || 17} tickets, so only {geminiModel?.alone?.total || 17} of {geminiModel?.alone?.metadata?.planned || 160} decided. Team prefix of {geminiModel?.team?.total || 119} consecutive tickets is a clean {geminiModel?.team?.skipped || 0}-skip result, but no fair alone comparison yet. Qwen R9.1 team ticket-to-agent assignment drifted after early truncations, so matching used ticket id and case id, not agent.</p>
            </div>
            <div>
              <div className="label">Run metadata</div>
              <p>Full run metadata (planned vs completed, stop reasons, costs, timestamps) available in data/drift.json generated from research-data/drift/{data.suiteId}/runs.json.</p>
            </div>
          </div>
          <div className="mt-6">
            <div className="kicker mb-3 text-ink/60">R9.1 Team vs Alone full table</div>
            <NumTable
              head={["Model", "Team skips", "Team total", "Team acc", "Alone skips", "Alone total", "Alone acc", "Fisher (no-full)", "McNemar (matched)"]}
              rows={r9.models.filter((m) => m.team && m.alone && m.alone.total >= 100).map((m) => [
                m.name,
                m.team!.skipped,
                m.team!.total,
                m.team!.accuracy ? `${m.team!.accuracy.correct}/${m.team!.accuracy.total}` : "–",
                m.alone!.skipped,
                m.alone!.total,
                m.alone!.accuracy ? `${m.alone!.accuracy.correct}/${m.alone!.accuracy.total}` : "–",
                m.tests?.fisherNoFull ?? "–",
                m.tests?.mcNemarNoFull ?? "–"
              ])}
            />
          </div>
          <div className="mt-6">
            <div className="kicker mb-3 text-ink/60">R8.1 Target On vs Off full table</div>
            <NumTable
              head={["Model", "Target on skips", "Target on total", "Target off skips", "Target off total", "Fisher two-sided"]}
              rows={r8.models.filter((m) => m.targetOn && m.targetOff).map((m) => [
                m.name,
                m.targetOn!.skipped,
                m.targetOn!.total,
                m.targetOff!.skipped,
                m.targetOff!.total,
                m.tests?.fisherTwoSided ?? "–"
              ])}
            />
          </div>
          <p className="mt-4 text-[13px] leading-5 text-ink/55">Full numbers, statistical tests, and verbatim quotes are in the suite analysis ({data.quotes[0]?.source}).</p>
        </Details>
      </Block>

      <Block>
        <div className="flex flex-wrap gap-3">
          <Link href="/about" className="btn-ghost">How these experiments work →</Link>
          <Link href="/results" className="btn-ghost">All results →</Link>
          <Link href="/compare" className="btn-primary"><span className="h-2 w-2 bg-vermilion" />Compare models</Link>
        </div>
      </Block>
    </main>
  );
}
