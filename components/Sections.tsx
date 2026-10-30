import Link from "next/link";
import { modelName, pct, scenarioTitle } from "@/lib/bundle";
import type { Baseline, Bundle, Pressure, SayDo, SelfInterest } from "@/lib/types";
import { HBar } from "./Bars";
import { ExampleTag } from "./Banner";

const optionText = (b: Bundle, scen: string, opt: string) => b.scenarios.find((s) => s.id === scen)?.judge_options?.[opt]?.replace(/\.$/, "") || opt;

export function SayDoTable({ b, rows }: { b: Bundle; rows: SayDo[] }) {
  return (
    <div className="card overflow-x-auto">
      <table className="w-full min-w-[720px] text-sm">
        <thead className="border-b border-black/10 text-left text-xs uppercase tracking-wide text-black/50">
          <tr><th className="p-3 font-semibold">Scenario</th><th className="p-3 font-semibold">Model</th><th className="p-3 font-semibold">Its stated view implies</th>
            <th className="p-3 text-right font-semibold text-say">Says</th><th className="p-3 text-right font-semibold text-judge">Judges</th><th className="p-3 text-right font-semibold text-do">Does</th><th className="p-3 text-right font-semibold">Gap</th></tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const d = r.do[0];
            const sayCons = r.say.agree_rate == null ? null : r.say.agree_rate >= 0.5 ? r.say.agree_rate : 1 - r.say.agree_rate;
            const gap = r.judge.consistent_rate != null && d?.consistent_rate != null ? r.judge.consistent_rate - d.consistent_rate : null;
            return (
              <tr key={r.scenario + r.model} className="border-b border-black/5 last:border-0 hover:bg-black/[0.02]">
                <td className="p-3"><Link href={`/scenarios/${r.scenario}`} className="font-medium hover:underline">{scenarioTitle(b, r.scenario)}</Link><div className="text-xs text-black/45">{r.scenario}{r.sample_size_note && <> · <span className="text-amber-700">{r.sample_size_note}</span></>}</div></td>
                <td className="p-3 text-black/70">{modelName(b, r.model)}</td>
                <td className="p-3 text-black/70">{optionText(b, r.scenario, r.say_implied_option)}</td>
                <td className="p-3 text-right font-mono tabular-nums">{pct(sayCons)}</td>
                <td className="p-3 text-right font-mono tabular-nums">{pct(r.judge.consistent_rate)}</td>
                <td className="p-3 text-right font-mono tabular-nums">{pct(d?.consistent_rate)}</td>
                <td className="p-3 text-right"><span className={`rounded-md px-2 py-0.5 font-mono text-xs font-semibold tabular-nums ${gap != null && Math.abs(gap) >= 0.3 ? "bg-amber-100 text-amber-900" : "bg-black/5 text-black/60"}`}>{gap == null ? "–" : `${gap > 0 ? "−" : gap < 0 ? "+" : ""}${Math.round(Math.abs(gap) * 100)} pts`}</span></td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="border-t border-black/5 p-3 text-xs text-black/50">Each column is the share of answers consistent with the option the model&apos;s own stated view implies. &ldquo;Gap&rdquo; = Judges minus Does, in the original version of the scenario. No column says which option is right.</p>
    </div>
  );
}

function siSub(c: SelfInterest["conditions"][number], control?: SelfInterest["conditions"][number]) {
  const shift = c.shift ?? (control ? (control.waive_rate - c.waive_rate) * (c.direction === "toward_waive" ? -1 : 1) : null);
  const parts = [shift == null ? null : shift === 0 ? "no shift" : `${shift > 0 ? "+" : "−"}${Math.round(Math.abs(shift) * 100)} pts toward ${c.self_serving_label || "self-serving"}${c.shift_p != null ? ` (p=${c.shift_p})` : ""}`];
  if (c.rationalization_n) parts.push(`${pct(c.rationalization_rate)} of those cited only principles`);
  return parts.filter(Boolean).join(" · ");
}

export function SelfInterestChart({ s, b }: { s: SelfInterest; b: Bundle }) {
  const control = s.conditions.find((c) => c.condition === "a_none");
  return (
    <div className="card p-5">
      <div className="flex flex-wrap items-center gap-2">
        <div className="text-sm font-semibold">{s.case_label}</div>
        {s.partial && <ExampleTag>In progress</ExampleTag>}
        <span className="ml-auto text-xs text-black/50">{modelName(b, s.model)} · {scenarioTitle(b, s.scenario)}</span>
      </div>
      <p className="mt-1 text-xs text-black/50">Share of runs where the model waived the fee. Every condition is the same scenario plus one sentence about the model&apos;s own interest. Shift = self-serving rate with the incentive minus without it (Fisher exact p). Small samples (n=20 each): exploratory.</p>
      <div className="mt-4 space-y-3">
        {s.conditions.map((c) => (
          <HBar key={c.condition} label={c.label} value={c.waive_rate} n={c.n}
            color={c.condition === "a_none" ? "bg-black/60" : c.direction === "toward_waive" ? "bg-sky-500" : "bg-do"}
            sub={c.condition === "a_none" ? "control" : siSub(c, control)} />
        ))}
      </div>
    </div>
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
    <div className="grid gap-4 md:grid-cols-2">
      {items.map((it) => {
        const rs = rows.filter((r) => r.item === it).sort((a, z) => ARM_ORDER.indexOf(a.arm) - ARM_ORDER.indexOf(z.arm));
        const small = rs.every((r) => r.n < 10);
        return (
          <div key={it} className="card p-5">
            <div className="flex items-center gap-2"><div className="text-sm font-semibold">{it}</div>{small && <ExampleTag>Smoke test · n≤3</ExampleTag>}<span className="ml-auto text-xs text-black/50">{modelName(b, rs[0].model)}</span></div>
            <p className="mt-1 text-xs text-black/50">Share of conversations where the answer moved away from the model&apos;s first answer. Moving for real information is reasonable; moving for flattery or authority is not.</p>
            <div className="mt-4 space-y-3">
              {rs.map((r) => (
                <HBar key={r.arm} label={ARM_LABEL[r.arm] || r.arm} value={r.flip_rate} n={r.n} color={r.arm === "information" ? "bg-emerald-600" : r.arm === "neutral_control" ? "bg-black/50" : "bg-judge"}
                  sub={r.recovery_rate != null ? `returned to first answer ${pct(r.recovery_rate)}` : undefined} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function BaselineTable({ rows }: { rows: Baseline[] }) {
  return (
    <div className="card overflow-x-auto">
      <table className="w-full min-w-[640px] text-sm">
        <thead className="border-b border-black/10 text-left text-xs uppercase tracking-wide text-black/50">
          <tr><th className="p-3">Item</th><th className="p-3">Instrument</th><th className="p-3 text-right">Model</th><th className="p-3">People (published data)</th></tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.item} className="border-b border-black/5 last:border-0">
              <td className="p-3"><div className="font-medium">{r.statement || r.item.replace("AWAD-", "Trolley: ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase())}</div><div className="text-xs text-black/45">{r.item} · n={r.n}</div></td>
              <td className="p-3 text-black/65">{r.instrument}</td>
              <td className="p-3 text-right font-mono tabular-nums">{r.act_rate != null ? `${pct(r.act_rate)} act` : r.mean != null ? `mean ${r.mean}` : "–"}</td>
              <td className="p-3 text-black/65">{r.human ? <><b className="font-mono">{pct(r.human.value)}</b> act<div className="text-xs text-black/45">{r.human.source}</div></> : <span className="text-xs text-black/40">Norms added with the full wave</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
