import { pct } from "@/lib/bundle";

/** Hairline gridlines at 0 / 50 / 100 %, shared by every horizontal chart. */
function Grid({ reference }: { reference?: number | null }) {
  return (
    <>
      {[0, 0.5, 1].map((t) => <div key={t} className={`absolute inset-y-0 w-px ${t === 0 ? "bg-ink/60" : "bg-ink/12"}`} style={{ left: `${t * 100}%` }} />)}
      {reference != null && <div className="absolute -inset-y-1 border-l border-dashed border-ink/70" style={{ left: `${reference * 100}%` }} />}
    </>
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

/**
 * One row of a lollipop chart: a thin stem from 0 and a dot at the value, value labelled directly.
 * `color` is a bg-* class. `reference` draws a dashed line (e.g. the control condition).
 */
export function HBar({ label, value, color = "bg-ink", sub, n, reference }: { label: string; value: number | null; color?: string; sub?: string; n?: number; reference?: number | null }) {
  const v = Math.min(1, Math.max(0, value ?? 0));
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_3.5rem] items-end gap-3">
      <div>
        <div className="mb-1 flex flex-wrap items-baseline justify-between gap-x-2">
          <span className="font-sans text-[13px] text-ink/85">{label}</span>
          {sub && <span className="font-sans text-[11px] text-ink/50">{sub}</span>}
        </div>
        <div className="relative h-3.5">
          <Grid reference={reference} />
          {value != null && <>
            <div className={`absolute top-1/2 h-[2px] -translate-y-1/2 ${color}`} style={{ left: 0, width: `${v * 100}%` }} />
            <div className={`absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-panel ${color}`} style={{ left: `${v * 100}%` }} />
          </>}
        </div>
      </div>
      <div className="text-right leading-tight">
        <span className="num text-[13px] font-medium">{pct(value)}</span>
        {n != null && <div className="num text-[10px] text-ink/45">n={n}</div>}
      </div>
    </div>
  );
}

/**
 * Says / tells others / does: share of runs that chose the option the model's own stated view implies.
 * Plain-language labels; the "does" column is the one that matters, so it carries the accent.
 */
export function Triptych({ say, judge, doo, option, sayLabel, judgeLabel, doLabel, n }: { say: number | null; judge: number | null; doo: number | null; option?: string; sayLabel?: string; judgeLabel?: string; doLabel?: string; n?: number | string }) {
  const cols = [
    { k: "Says it's right", v: say, c: "bg-say", t: "text-say", d: sayLabel },
    { k: "Tells another agent to", v: judge, c: "bg-prussian-2", t: "text-prussian-2", d: judgeLabel },
    { k: "Actually does it, with tools", v: doo, c: "bg-do", t: "text-do", d: doLabel },
  ];
  const gap = judge != null && doo != null ? judge - doo : null;
  return (
    <div>
      {option && <p className="mb-4 font-sans text-[13px] text-ink/70">The option: <b className="font-medium text-ink">{option.replace(/\.$/, "")}</b></p>}
      <div className="relative grid grid-cols-3 gap-4 border-b border-ink">
        <div className="pointer-events-none absolute inset-x-0 top-7 border-t border-dashed border-ink/15" title="100%" />
        {cols.map((c, i) => (
          <div key={c.k} className="flex h-44 flex-col justify-end">
            <div className={`num mb-1 text-center font-medium ${i === 2 ? "text-2xl text-do" : "text-lg"}`}>{pct(c.v)}</div>
            <div className={`mx-auto w-12 ${c.c}`} style={{ height: `${Math.max(c.v ?? 0, 0.012) * (176 - 28 - 28)}px` }} />
          </div>
        ))}
      </div>
      <div className="mt-2 grid grid-cols-3 gap-4">
        {cols.map((c) => (
          <div key={c.k} className="text-center">
            <div className={`font-sans text-[12px] font-semibold leading-tight ${c.t}`}>{c.k}</div>
            {c.d && <div className="mt-0.5 font-sans text-[11px] leading-snug text-ink/55">{c.d}</div>}
          </div>
        ))}
      </div>
      <p className="mt-3 font-sans text-[11px] text-ink/55">{n ? `% of ${n} runs` : "% of runs"} that chose {option ? "this option" : "the option its own stated view implies"}. Same situation each time; only the framing changes.</p>
      {gap != null && Math.abs(gap) >= 0.2 && (
        <p className="mt-2 border-l-2 border-vermilion pl-2 font-serif text-[16px] italic text-ink/85">
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

/**
 * Annotated "Figure" for the hero and finding pages: rows on a 0–100 axis, with a bracket
 * drawn between the highest and lowest rows when they are far apart.
 */
export function Figure({ rows, color = "#c23b1e", axis, takeaway }: { rows: { label: string; value: number | null }[]; color?: string; axis?: string; takeaway?: string }) {
  const W = 640, L = 250, R = 540, rowH = 52, top = 22;
  const H = top + rows.length * rowH + 22;
  const x = (v: number) => L + (R - L) * Math.min(1, Math.max(0, v));
  const vals = rows.map((r) => r.value ?? 0);
  const hi = vals.indexOf(Math.max(...vals)), lo = vals.lastIndexOf(Math.min(...vals));
  const gap = vals[hi] - vals[lo];
  const y = (i: number) => top + i * rowH + rowH / 2;
  return (
    <div>
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={rows.map((r) => `${r.label}: ${pct(r.value)}`).join("; ")}>
      {[0, 0.25, 0.5, 0.75, 1].map((t) => (
        <g key={t}>
          <line x1={x(t)} x2={x(t)} y1={top - 6} y2={H - 18} stroke="#12161b" strokeOpacity={t === 0 ? 0.7 : 0.12} />
          <text x={x(t)} y={H - 4} textAnchor="middle" fontSize="11" fill="#12161b" fillOpacity="0.5" fontFamily="var(--font-mono)">{Math.round(t * 100)}%</text>
        </g>
      ))}
      {rows.map((r, i) => {
        const v = r.value ?? 0;
        const isLo = i === lo && gap >= 0.2;
        return (
          <g key={r.label}>
            <text x={0} y={y(i) + 4 - (wrap(r.label).length - 1) * 8} fontSize="15" fill={isLo ? color : "#12161b"} fontWeight={isLo ? 600 : 400} fontFamily="var(--font-plex-sans)">{wrap(r.label).map((t, j) => <tspan key={j} x={0} dy={j ? 17 : 0}>{t}</tspan>)}</text>
            <line x1={x(0)} x2={x(v)} y1={y(i)} y2={y(i)} stroke={isLo ? color : "#12161b"} strokeWidth="2" />
            <circle cx={x(v)} cy={y(i)} r="6" fill={isLo ? color : "#12161b"} stroke="#f4f6f8" strokeWidth="2" />
            <text x={x(v) + (v > 0.85 ? -12 : 12)} y={y(i) - 9} textAnchor={v > 0.85 ? "end" : "start"} fontSize="14" fontFamily="var(--font-mono)" fill={isLo ? color : "#12161b"}>{Math.round(v * 100)}%</text>
          </g>
        );
      })}
      {gap >= 0.2 && (() => {
        const bx = R + 22, y1 = y(hi), y2 = y(lo);
        return (
          <g>
            <path d={`M ${bx - 6} ${y1} H ${bx} V ${y2} H ${bx - 6}`} fill="none" stroke={color} strokeWidth="1.5" />
            <text x={bx + 6} y={(y1 + y2) / 2 - 4} fontSize="16" fontWeight="600" fill={color} fontFamily="var(--font-mono)">{Math.round(gap * 100)}</text>
            <text x={bx + 6} y={(y1 + y2) / 2 + 11} fontSize="11" fill={color} fontFamily="var(--font-plex-sans)">pt gap</text>
          </g>
        );
      })()}
    </svg>
    {axis && <p className="mt-1 font-sans text-[12px] text-ink/60">{axis}</p>}
    {takeaway && <p className="mt-3 border-l-2 border-vermilion pl-3 font-serif text-[18px] leading-snug text-ink">{takeaway}</p>}
    </div>
  );
}
