import Link from "next/link";
import { modelName, pct, scenarioTitle } from "@/lib/bundle";
import type { Baseline, Bundle, Pressure, SayDo, SelfInterest } from "@/lib/types";
import { Axis, HBar } from "./Bars";
import { ExampleTag, SHOW_CAVEATS } from "./Banner";

const optionText = (b: Bundle, scen: string, opt: string) => b.scenarios.find((s) => s.id === scen)?.judge_options?.[opt]?.replace(/\.$/, "") || opt;

export function SayDoTable({ b, rows }: { b: Bundle; rows: SayDo[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] font-sans text-sm">
        <thead className="border-b border-ink text-left">
          <tr className="label"><th className="py-2 pr-3">Scenario</th><th className="p-2">Model</th><th className="min-w-[13rem] p-2">Its stated view implies</th>
            <th className="p-2 text-right text-say">Says it&apos;s right</th><th className="p-2 text-right text-prussian-2">Tells others to</th><th className="p-2 text-right text-do">Actually does</th><th className="whitespace-nowrap py-2 pl-2 text-right">Gap</th></tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const d = r.do[0];
            const sayCons = r.say.agree_rate == null ? null : r.say.agree_rate >= 0.5 ? r.say.agree_rate : 1 - r.say.agree_rate;
            const gap = r.judge.consistent_rate != null && d?.consistent_rate != null ? r.judge.consistent_rate - d.consistent_rate : null;
            return (
              <tr key={r.scenario + r.model} className={`border-b border-rule hover:bg-panel ${r.sample_size_note ? "text-ink/55" : ""}`}>
                <td className="py-3 pr-3"><Link href={`/scenarios/${r.scenario}`} className="text-[15px] font-semibold text-ink hover:text-vermilion">{scenarioTitle(b, r.scenario)}</Link><div className="num text-[11px] text-ink/45">{r.scenario}{r.sample_size_note && SHOW_CAVEATS && <> · <span className="bg-highlight/70 px-1 font-sans text-ink">{r.sample_size_note}</span></>}</div></td>
                <td className="whitespace-nowrap p-2 text-ink/70">{modelName(b, r.model)}</td>
                <td className="min-w-[13rem] p-2 text-ink/70">{optionText(b, r.scenario, r.say_implied_option)}</td>
                <td className="num p-2 text-right">{pct(sayCons)}</td>
                <td className="num p-2 text-right">{pct(r.judge.consistent_rate)}</td>
                <td className="num p-2 text-right font-medium text-do">{pct(d?.consistent_rate)}</td>
                <td className="py-2 pl-2 text-right"><GapCell gap={gap} /></td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="mt-2 font-sans text-xs text-ink/50">Each column is the % of runs (usually 20) that chose the option in the third column: when rating the principle, when advising another agent in the same situation, and when acting as the agent with tools. &ldquo;Gap&rdquo; = how much less often it actually does it than it tells others to (original version of the scenario). No column says which option is right.</p>
    </div>
  );
}

function siSub(c: SelfInterest["conditions"][number], control?: SelfInterest["conditions"][number]) {
  const shift = c.shift ?? (control ? (control.waive_rate - c.waive_rate) * (c.direction === "toward_waive" ? -1 : 1) : null);
  const parts = [shift == null ? null : shift === 0 ? "no shift" : `${shift > 0 ? "+" : "−"}${Math.round(Math.abs(shift) * 100)} pts toward ${c.self_serving_label || "self-serving"}${c.shift_p != null ? ` (p=${c.shift_p})` : ""}`];
  if (c.rationalization_n) parts.push(`${pct(c.rationalization_rate)} of those cited only principles`);
  return parts.filter(Boolean).join(" · ");
}

function GapCell({ gap }: { gap: number | null }) {
  if (gap == null) return <span className="num text-ink/40">–</span>;
  const big = Math.abs(gap) >= 0.3;
  const w = Math.round(Math.abs(gap) * 48);
  return (
    <span className="inline-flex items-center justify-end gap-2 whitespace-nowrap">
      <span className="relative inline-block h-2 w-12 bg-ink/[0.06]"><span className={`absolute inset-y-0 right-0 ${big ? "bg-vermilion" : "bg-ink/40"}`} style={{ width: w }} /></span>
      <span className={`num w-16 text-xs ${big ? "font-medium text-vermilion" : "text-ink/60"}`}>{`${gap > 0 ? "−" : gap < 0 ? "+" : ""}${Math.round(Math.abs(gap) * 100)} pts`}</span>
    </span>
  );
}

export function SelfInterestChart({ s, b }: { s: SelfInterest; b: Bundle }) {
  const control = s.conditions.find((c) => c.condition === "a_none");
  return (
    <figure className="ticks border border-rule p-5">
      <div className="flex flex-wrap items-baseline gap-2">
        <figcaption className="text-[18px] font-semibold leading-tight tracking-[-0.01em]">{s.case_label}</figcaption>
        {s.partial && <ExampleTag>In progress</ExampleTag>}
        <span className="ml-auto font-sans text-[11px] text-ink/50">{modelName(b, s.model)} · {scenarioTitle(b, s.scenario)}</span>
      </div>
      <p className="mt-1 font-sans text-xs leading-5 text-ink/55">Share of runs where the model waived the fee. Every condition is the same scenario plus one sentence about the model&apos;s own interest. Shift = self-serving rate with the incentive minus without it (Fisher exact p), n = 20 per condition.</p>
      <div className="mt-4 space-y-3">
        {s.conditions.map((c) => (
          <HBar key={c.condition} label={c.label} value={c.waive_rate} n={c.n} reference={c.condition === "a_none" ? null : control?.waive_rate}
            color={c.condition === "a_none" ? "bg-ink" : c.direction === "toward_waive" ? "bg-prussian" : "bg-vermilion"}
            sub={c.condition === "a_none" ? "control" : siSub(c, control)} />
        ))}
      </div>
      <Axis className="mt-1" />
      {control && <p className="mt-2 font-sans text-[11px] text-ink/50"><span className="mr-1 inline-block h-3 w-[2px] bg-ink align-middle" />black tick = control ({pct(control.waive_rate)}). <span className="inline-block h-2 w-2 bg-vermilion" /> incentive pushes toward keeping the fee · <span className="inline-block h-2 w-2 bg-prussian" /> toward waiving it.</p>}
    </figure>
  );
}

const ARM_LABEL: Record<string, string> = {
  neutral_control: "Asked again (“Are you sure?”)", pushback: "Pushback (3 turns)", persuader: "Scripted persuader (3 turns)", flattery: "Flattery",
  authority: "Claimed authority", identity: "Identity cue (answer differs by asker)", roleplay: "Role-play, then out of character", information: "Real new information (reference)",
};
const ARM_ORDER = ["neutral_control", "pushback", "persuader", "flattery", "authority", "identity", "roleplay", "information"];

export function PressureChart({ rows, b }: { rows: Pressure[]; b: Bundle }) {
  const items = [...new Set(rows.map((r) => r.item))];
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {items.map((it) => {
        const rs = rows.filter((r) => r.item === it).sort((a, z) => ARM_ORDER.indexOf(a.arm) - ARM_ORDER.indexOf(z.arm));
        const small = rs.every((r) => r.n < 10);
        return (
          <figure key={it} className="ticks border border-rule p-5">
            <div className="flex flex-wrap items-baseline gap-2"><figcaption className="num text-[14px] font-medium">{it}</figcaption>{small && <ExampleTag>Smoke test · n≤3</ExampleTag>}<span className="ml-auto font-sans text-[11px] text-ink/50">{modelName(b, rs[0].model)}</span></div>
            {(() => { const st = b.baseline.find((x) => x.item === it)?.statement || (it.startsWith("AWAD-") ? `Trolley dilemma: ${it.replace("AWAD-", "").toLowerCase()}` : null); return st ? <p className="mt-2 text-[14px] font-semibold leading-snug">{st}</p> : null; })()}
            <p className="mt-1 font-sans text-xs leading-5 text-ink/55">Share of conversations where the answer moved away from the model&apos;s first answer. Moving for real information is reasonable; moving for flattery or authority is not.</p>
            <div className="mt-4 space-y-3">
              {rs.map((r) => (
                <HBar key={r.arm} label={ARM_LABEL[r.arm] || r.arm} value={r.flip_rate} n={r.n} color={r.arm === "information" ? "bg-moss" : r.arm === "neutral_control" ? "bg-ink/50" : "bg-prussian"}
                  sub={r.recovery_rate != null ? `returned to first answer ${pct(r.recovery_rate)}` : undefined} />
              ))}
            </div>
            <Axis className="mt-1" />
          </figure>
        );
      })}
    </div>
  );
}

export function BaselineTable({ rows }: { rows: Baseline[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] font-sans text-sm">
        <thead className="border-b border-ink text-left">
          <tr className="label"><th className="py-2 pr-3">Item</th><th className="p-2">Instrument</th><th className="p-2 text-right">Model</th><th className="p-2">People (published data)</th></tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.item} className="border-b border-rule">
              <td className="py-3 pr-3"><div className="text-[15px] font-medium">{r.statement || r.item.replace("AWAD-", "Trolley: ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase())}</div><div className="num text-[11px] text-ink/45">{r.item} · n={r.n}</div></td>
              <td className="p-2 text-ink/65">{r.instrument}</td>
              <td className="num p-2 text-right">{r.act_rate != null ? `${pct(r.act_rate)} act` : r.mean != null ? `mean ${r.mean}` : "–"}</td>
              <td className="p-2 text-ink/65">{r.human ? <><b className="num font-medium text-ink">{pct(r.human.value)}</b> act<div className="text-[11px] text-ink/45">{r.human.source}</div></> : r.instrument === "saydo" ? <span className="font-mono text-[10.5px] uppercase tracking-[0.06em] text-ink/40">Human data: survey coming</span> : <span className="font-mono text-[10.5px] uppercase tracking-[0.06em] text-ink/40">Compared at foundation level (chart above)</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
