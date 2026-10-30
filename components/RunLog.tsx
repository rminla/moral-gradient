import type { RunInfo } from "@/lib/types";

const BADGE: Record<string, string> = { exploratory: "border-moss text-moss", superseded: "border-brass text-brass", excluded: "border-ink/30 text-ink/50" };
const pt = (s: string) => new Date(s).toLocaleString("en-US", { timeZone: "America/Los_Angeles", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) + " PT";

/** Every run, including ones we don't chart. superseded = replaced by a fixed rerun; excluded = probe or aborted. */
export default function RunLog({ runs }: { runs: RunInfo[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] font-sans text-sm">
        <thead className="border-b-2 border-ink text-left"><tr className="label"><th className="py-2 pr-3">Run</th><th className="p-2">Status</th><th className="p-2">What it was</th><th className="py-2 pl-3 text-right">Cost</th></tr></thead>
        <tbody>
          {[...runs].reverse().map((r) => (
            <tr key={r.run_id} className={`border-b border-ink/10 ${r.validity !== "exploratory" ? "text-ink/55" : ""}`}>
              <td className="py-2.5 pr-3 align-top"><div className="num text-xs">{r.run_id}</div><div className="text-[11px] text-ink/45">{pt(r.started_utc)} · {r.kind}{r.model ? ` · ${r.model}` : ""}</div></td>
              <td className="p-2 align-top"><span className={`border px-1.5 py-px text-[10px] font-semibold uppercase tracking-[0.08em] ${BADGE[r.validity] || "border-ink/30"}`}>{r.validity === "exploratory" ? "charted" : r.validity}</span></td>
              <td className="p-2 align-top text-xs leading-5">{r.note}</td>
              <td className="num py-2.5 pl-3 text-right align-top text-xs">{r.cost_usd != null ? `$${r.cost_usd.toFixed(4)}` : "–"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 font-sans text-xs text-ink/50">&ldquo;Charted&rdquo; runs are the ones shown in the charts above. Superseded runs were replaced by a fixed rerun and excluded runs were probes or aborted; both are listed for transparency and never charted. Costs are ledger estimates (tokens × list price).</p>
    </div>
  );
}
