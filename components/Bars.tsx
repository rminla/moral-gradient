import { pct } from "@/lib/bundle";

export function HBar({ label, value, color = "bg-ink", sub, n }: { label: string; value: number | null; color?: string; sub?: string; n?: number }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_3.5rem] items-center gap-3">
      <div>
        <div className="mb-1 flex flex-wrap items-baseline justify-between gap-x-2 text-sm">
          <span className="text-black/80">{label}</span>
          {sub && <span className="text-xs text-black/45">{sub}</span>}
        </div>
        <div className="h-2.5 overflow-hidden rounded-full bg-black/[0.06]">
          <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.max(value ?? 0, 0.01) * 100}%` }} />
        </div>
      </div>
      <div className="text-right font-mono text-sm tabular-nums">
        {pct(value)}
        {n != null && <div className="text-[10px] text-black/40">n={n}</div>}
      </div>
    </div>
  );
}

/** Say / Judge / Do columns: share of answers consistent with the model's own stated view. */
export function Triptych({ say, judge, doo, sayLabel, judgeLabel, doLabel }: { say: number | null; judge: number | null; doo: number | null; sayLabel: string; judgeLabel: string; doLabel: string }) {
  const cols = [
    { k: "Says", v: say, c: "bg-say", t: "text-say", d: sayLabel },
    { k: "Judges", v: judge, c: "bg-judge", t: "text-judge", d: judgeLabel },
    { k: "Does", v: doo, c: "bg-do", t: "text-do", d: doLabel },
  ];
  return (
    <div className="grid grid-cols-3 gap-3">
      {cols.map((c) => (
        <div key={c.k} className="flex flex-col">
          <div className="relative h-40 overflow-hidden rounded-xl bg-black/[0.04]">
            <div className={`absolute inset-x-0 bottom-0 ${c.c} opacity-90`} style={{ height: `${Math.max(c.v ?? 0, 0.015) * 100}%` }} />
            <div className="absolute inset-x-0 top-2 text-center font-mono text-xl font-semibold tabular-nums">{pct(c.v)}</div>
          </div>
          <div className={`mt-2 text-sm font-semibold ${c.t}`}>{c.k}</div>
          <div className="text-xs leading-snug text-black/55">{c.d}</div>
        </div>
      ))}
    </div>
  );
}
