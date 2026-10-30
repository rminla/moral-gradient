import { pct } from "@/lib/bundle";

/* Direction A chart language: every bar is a strip of 20 square cells, one cell = 5% of runs.
   Words are ink/grey, deeds are signal red. Labels and numbers in mono. */

const CELLS = 20;

/** A strip of 20 square cells, filled to `value`. `color` is a bg-* class. */
export function Cells({ value, color = "bg-ink", size = "h-3", hollow = "bg-panel", animate = false, delay = 0 }: { value: number | null; color?: string; size?: string; hollow?: string; animate?: boolean; delay?: number }) {
  const filled = Math.round(Math.min(1, Math.max(0, value ?? 0)) * CELLS);
  return (
    <div className="grid grid-cols-[repeat(20,minmax(0,1fr))] gap-[2px]">
      {Array.from({ length: CELLS }, (_, i) => (
        <span key={i} className={`${size} ${i < filled ? color : hollow} ${animate ? "cell-in" : ""}`} style={animate ? { animationDelay: `${delay + i * 25}ms` } : undefined} />
      ))}
    </div>
  );
}

/** Axis labels for a stack of HBars. */
export function Axis({ className = "" }: { className?: string }) {
  return (
    <div className={`grid grid-cols-[minmax(0,1fr)_3.5rem] gap-3 ${className}`}>
      <div className="relative h-3 font-mono text-[10px] text-ink/45">
        <span className="absolute left-0">0%</span><span className="absolute left-1/2 -translate-x-1/2">50%</span><span className="absolute right-0">100%</span>
      </div>
      <div />
    </div>
  );
}

/** One row: label, a 20-cell strip, the value. `reference` marks a control condition with a black tick. */
export function HBar({ label, value, color = "bg-ink", sub, n, reference }: { label: string; value: number | null; color?: string; sub?: string; n?: number; reference?: number | null }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_3.5rem] items-end gap-3">
      <div>
        <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-x-2">
          <span className="text-[13px] text-ink/85">{label}</span>
          {sub && <span className="font-mono text-[10.5px] text-ink/50">{sub}</span>}
        </div>
        <div className="relative">
          <Cells value={value} color={color} />
          {reference != null && <div className="absolute -inset-y-1 w-[2px] bg-ink" style={{ left: `${Math.min(1, Math.max(0, reference)) * 100}%` }} title="control" />}
        </div>
      </div>
      <div className="text-right leading-tight">
        <span className="num text-[13px] font-medium">{pct(value)}</span>
        {n != null && <div className="num text-[10px] text-ink/45">n={n}</div>}
      </div>
    </div>
  );
}

/** Says / tells others / does as three stacks of 10 cells (10% each). The "does" stack carries the red. */
export function Triptych({ say, judge, doo, option, sayLabel, judgeLabel, doLabel, n }: { say: number | null; judge: number | null; doo: number | null; option?: string; sayLabel?: string; judgeLabel?: string; doLabel?: string; n?: number | string }) {
  const cols = [
    { k: "Says it's right", v: say, c: "bg-say", t: "text-say", d: sayLabel },
    { k: "Tells another agent to", v: judge, c: "bg-prussian-2", t: "text-prussian-2", d: judgeLabel },
    { k: "Actually does it, with tools", v: doo, c: "bg-do", t: "text-do", d: doLabel },
  ];
  const gap = judge != null && doo != null ? judge - doo : null;
  return (
    <div>
      {option && <p className="mb-4 text-[13px] text-ink/70">The option: <b className="font-semibold text-ink">{option.replace(/\.$/, "")}</b></p>}
      <div className="grid grid-cols-3 gap-px border border-rule bg-rule">
        {cols.map((c, i) => {
          const filled = Math.round(Math.min(1, Math.max(0, c.v ?? 0)) * 10);
          return (
            <div key={c.k} className="flex flex-col items-center bg-paper px-2 pb-3 pt-4">
              <div className={`num mb-2 font-medium ${i === 2 ? "text-2xl text-do" : "text-lg"}`}>{pct(c.v)}</div>
              <div className="flex flex-col-reverse gap-[3px]">
                {Array.from({ length: 10 }, (_, j) => <span key={j} className={`h-3 w-10 ${j < filled ? c.c : "bg-panel"}`} />)}
              </div>
              <div className={`mt-3 text-center font-mono text-[10.5px] font-medium uppercase leading-tight tracking-[0.04em] ${c.t}`}>{c.k}</div>
              {c.d && <div className="mt-1 text-center text-[11px] leading-snug text-ink/55">{c.d}</div>}
            </div>
          );
        })}
      </div>
      <p className="mt-3 font-mono text-[10.5px] text-ink/55">{n ? `% of ${n} runs` : "% of runs"} that chose {option ? "this option" : "the option its own stated view implies"}. Same situation each time; only the framing changes.</p>
      {gap != null && Math.abs(gap) >= 0.2 && (
        <p className="mt-2 border-l-2 border-vermilion pl-2 text-[16px] font-medium text-ink/85">
          {gap > 0 ? `It does it ${Math.round(gap * 100)} points less often than it tells others to.` : `It does it ${Math.round(-gap * 100)} points more often than it tells others to.`}
        </p>
      )}
    </div>
  );
}

/** Split a label onto at most two lines for the SVG figure. */
function wrap(t: string, max = 28): string[] {
  if (t.length <= max) return [t];
  const cut = t.lastIndexOf(" ", max);
  return cut > 0 ? [t.slice(0, cut), t.slice(cut + 1)] : [t];
}

/** Annotated figure: each row is 20 square cells; the lowest row, if far below the highest, goes red. */
export function Figure({ rows, color = "#ff3d1f", axis, takeaway }: { rows: { label: string; value: number | null }[]; color?: string; axis?: string; takeaway?: string }) {
  const W = 640, L = 250, R = 560, rowH = 52, top = 14;
  const H = top + rows.length * rowH + 4;
  const cw = (R - L) / CELLS;
  const vals = rows.map((r) => r.value ?? 0);
  const hi = vals.indexOf(Math.max(...vals)), lo = vals.lastIndexOf(Math.min(...vals));
  const gap = vals[hi] - vals[lo];
  const y = (i: number) => top + i * rowH + rowH / 2;
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={rows.map((r) => `${r.label}: ${pct(r.value)}`).join("; ")}>
        {rows.map((r, i) => {
          const v = Math.min(1, Math.max(0, r.value ?? 0));
          const filled = Math.round(v * CELLS);
          const isLo = i === lo && gap >= 0.2;
          return (
            <g key={r.label}>
              <text x={0} y={y(i) + 4 - (wrap(r.label).length - 1) * 8} fontSize="15" fill={isLo ? color : "#0c0c0d"} fontWeight={isLo ? 650 : 400} fontFamily="var(--font-display)">{wrap(r.label).map((t, j) => <tspan key={j} x={0} dy={j ? 17 : 0}>{t}</tspan>)}</text>
              {Array.from({ length: CELLS }, (_, j) => (
                <rect key={j} x={L + j * cw} y={y(i) - 9} width={cw - 2} height={18} fill={j < filled ? (isLo ? color : i === 0 ? "#0c0c0d" : "#6c6f75") : "#f0f0ee"} stroke={isLo && j >= filled ? color : "none"} strokeOpacity={0.35} />
              ))}
              <text x={R + 12} y={y(i) + 5} fontSize="15" fontWeight="600" fontFamily="var(--font-numeric)" fill={isLo ? color : "#0c0c0d"}>{Math.round(v * 100)}%</text>
            </g>
          );
        })}
      </svg>
      {axis && <p className="mt-1 font-mono text-[11px] text-ink/60">{axis} · one cell = 5%</p>}
      {takeaway && <p className="mt-3 border-l-2 border-vermilion pl-3 text-[18px] font-medium leading-snug text-ink">{takeaway}</p>}
    </div>
  );
}
