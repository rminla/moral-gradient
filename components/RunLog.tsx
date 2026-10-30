import type { RunInfo } from "@/lib/types";

const BADGE: Record<string, string> = { exploratory: "bg-emerald-100 text-emerald-800", superseded: "bg-amber-100 text-amber-800", excluded: "bg-black/10 text-black/55" };
const pt = (s: string) => new Date(s).toLocaleString("en-US", { timeZone: "America/Los_Angeles", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) + " PT";

/** Every run, including ones we don't chart. superseded = replaced by a fixed rerun; excluded = probe or aborted. */
export default function RunLog({ runs }: { runs: RunInfo[] }) {
  return (
    <div className="card overflow-x-auto">
      <table className="w-full min-w-[720px] text-sm">
        <thead className="border-b border-black/10 text-left text-xs uppercase tracking-wide text-black/50"><tr><th className="p-3">Run</th><th className="p-3">Status</th><th className="p-3">What it was</th><th className="p-3 text-right">Cost</th></tr></thead>
        <tbody>
          {[...runs].reverse().map((r) => (
            <tr key={r.run_id} className={`border-b border-black/5 last:border-0 ${r.validity !== "exploratory" ? "text-black/55" : ""}`}>
              <td className="p-3 align-top"><div className="font-mono text-xs">{r.run_id}</div><div className="text-xs text-black/45">{pt(r.started_utc)} · {r.kind}{r.model ? ` · ${r.model}` : ""}</div></td>
              <td className="p-3 align-top"><span className={`rounded-md px-2 py-0.5 text-xs font-semibold ${BADGE[r.validity] || "bg-black/5"}`}>{r.validity === "exploratory" ? "charted" : r.validity}</span></td>
              <td className="p-3 align-top text-xs leading-5">{r.note}</td>
              <td className="p-3 text-right align-top font-mono text-xs">{r.cost_usd != null ? `$${r.cost_usd.toFixed(4)}` : "–"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="border-t border-black/5 p-3 text-xs text-black/50">&ldquo;Charted&rdquo; runs are exploratory pilot data. Superseded runs were replaced by a fixed rerun and excluded runs were probes or aborted; both are listed for transparency and never charted. Costs are ledger estimates (tokens × list price).</p>
    </div>
  );
}
