import Link from "next/link";
import type { Diff, Prop, V3 } from "@/lib/v3";
import { fmtCI, fmtPct, fmtPts } from "@/lib/v3";
import { modelMeta, modelSlug, TRACE_LABEL } from "@/lib/v3meta";

/* Shared v3 chart language (Signal): mono labels, square marks, words grey, deeds signal red.
   Every chart is a plain row-per-model figure; CIs are drawn as thin whiskers and listed in the expandable details. */

/** Always visible while the bundle is preliminary (independent of NEXT_PUBLIC_SHOW_CAVEATS). */
export function PreviewBanner({ v }: { v: V3 }) {
  if (v.status === "final") return null;
  return (
    <div className="border-b border-rule bg-paper">
      <div className="mx-auto flex max-w-[1200px] flex-wrap items-baseline gap-x-4 gap-y-1 px-5 py-2 md:px-8">
        <span className="font-mono text-[10.5px] uppercase tracking-[0.08em] text-ink/60">{v.label}</span>
        <span className="text-[12.5px] leading-snug text-ink/50">
          From methodology-development runs ({v.source}). Samples are small and designs changed between rounds, so treat numbers as provisional; the final run will replace them.
        </span>
      </div>
    </div>
  );
}

export function PreviewTag({ v }: { v: V3 }) {
  if (v.status === "final") return null;
  return <span className="inline-flex items-center font-mono text-[10px] uppercase tracking-[0.08em] text-ink/45">{v.label}</span>;
}

export function ModelName({ id, link = true, className = "" }: { id: string; link?: boolean; className?: string }) {
  const m = modelMeta(id);
  const inner = <><span className="font-semibold">{m.name}</span>{m.open && <span className="ml-1.5 font-mono text-[9.5px] uppercase tracking-[0.06em] text-ink/40">open</span>}</>;
  return link ? <Link href={`/models/${modelSlug(id)}`} className={`hover:text-vermilion ${className}`}>{inner}</Link> : <span className={className}>{inner}</span>;
}

export function FidelityTag({ fidelity }: { fidelity: string }) {
  const raw = fidelity === "raw";
  return <span className={`inline-flex border px-1.5 py-px font-mono text-[9.5px] uppercase tracking-[0.06em] ${raw ? "border-ink text-ink" : "border-dashed border-ink/40 text-ink/55"}`}>{TRACE_LABEL[fidelity] ?? fidelity}</span>;
}

/* ───────────── Dot plot: 0–100% per row, several marks per row ───────────── */
export type Mark = { key: string; label: string; p: Prop | null | undefined; tone: "do" | "say" | "judge" | "ink" | "light" };
const TONE: Record<Mark["tone"], { dot: string; text: string; line: string }> = {
  do: { dot: "bg-vermilion", text: "text-vermilion", line: "bg-vermilion/50" },
  say: { dot: "bg-prussian", text: "text-prussian", line: "bg-prussian/50" },
  judge: { dot: "bg-prussian-2", text: "text-prussian", line: "bg-prussian-2/60" },
  ink: { dot: "bg-ink", text: "text-ink", line: "bg-ink/40" },
  light: { dot: "border-2 border-ink bg-paper", text: "text-ink/70", line: "bg-ink/25" },
};
const pos = (x: number | null | undefined) => `${Math.min(100, Math.max(0, (x ?? 0) * 100))}%`;

export function DotLegend({ marks }: { marks: Omit<Mark, "p">[] }) {
  return (
    <div className="flex flex-wrap gap-x-5 gap-y-1 font-mono text-[10.5px] uppercase tracking-[0.06em] text-ink/60">
      {marks.map((m) => <span key={m.key} className="flex items-center gap-1.5"><span className={`h-2.5 w-2.5 ${TONE[m.tone].dot}`} />{m.label}</span>)}
    </div>
  );
}

export function DotChart({ rows, reference, connect = true }: { rows: { id: string; label: React.ReactNode; sub?: React.ReactNode; marks: Mark[] }[]; reference?: { value: number; label: string } | null; connect?: boolean }) {
  return (
    <div>
      <div className="divide-y divide-rule border-y border-rule">
        {rows.map((r) => {
          const ps = r.marks.map((m) => m.p?.p).filter((x): x is number => x != null);
          const lo = Math.min(...ps), hi = Math.max(...ps);
          return (
            <div key={r.id} className="grid grid-cols-1 gap-2 py-3.5 md:grid-cols-[190px_minmax(0,1fr)_150px] md:items-center md:gap-5">
              <div className="text-[14px] leading-tight">{r.label}{r.sub && <div className="mt-0.5 font-mono text-[10px] text-ink/45">{r.sub}</div>}</div>
              <div className="relative h-7">
                <div className="absolute inset-x-0 top-1/2 h-px bg-rule" />
                {[0.25, 0.5, 0.75].map((t) => <div key={t} className="absolute inset-y-1 w-px bg-rule" style={{ left: pos(t) }} />)}
                {reference && <div className="absolute -inset-y-1 w-[2px] bg-moss" style={{ left: pos(reference.value) }} title={reference.label} />}
                {connect && ps.length > 1 && <div className="absolute top-1/2 h-[3px] -translate-y-1/2 bg-ink/15" style={{ left: pos(lo), width: `${(hi - lo) * 100}%` }} />}
                {r.marks.map((m) => m.p?.p == null ? null : (
                  <div key={m.key}>
                    {m.p.lo != null && m.p.hi != null && <div className={`absolute top-1/2 h-px -translate-y-[5px] ${TONE[m.tone].line}`} style={{ left: pos(m.p.lo), width: `${(m.p.hi - m.p.lo) * 100}%` }} />}
                    <div className={`absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 ${TONE[m.tone].dot}`} style={{ left: pos(m.p.p) }} title={`${m.label}: ${fmtPct(m.p.p)} (${m.p.k}/${m.p.n})`} />
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap justify-start gap-x-3 font-mono text-[11.5px] md:justify-end">
                {r.marks.map((m) => <span key={m.key} className={TONE[m.tone].text}>{fmtPct(m.p?.p)}</span>)}
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-1 grid grid-cols-1 md:grid-cols-[190px_minmax(0,1fr)_150px] md:gap-5">
        <div />
        <div className="relative h-4 font-mono text-[10px] text-ink/45">
          <span className="absolute left-0">0%</span><span className="absolute left-1/4 -translate-x-1/2">25%</span><span className="absolute left-1/2 -translate-x-1/2">50%</span><span className="absolute left-3/4 -translate-x-1/2">75%</span><span className="absolute right-0">100%</span>
        </div>
      </div>
      {reference && <p className="mt-2 font-mono text-[10.5px] text-ink/55"><span className="mr-1.5 inline-block h-3 w-[2px] bg-moss align-middle" />{reference.label}</p>}
    </div>
  );
}

/* ───────────── Difference plot: −100 … +100 points, zero line in the middle ───────────── */
export function DiffChart({ rows, leftLabel, rightLabel }: { rows: { id: string; label: React.ReactNode; sub?: React.ReactNode; d: Diff; tone?: "do" | "ink" | "say" | "moss"; dim?: boolean }[]; leftLabel: string; rightLabel: string }) {
  const x = (v: number | null | undefined) => `${50 + Math.max(-1, Math.min(1, v ?? 0)) * 50}%`;
  const tone = (t?: string) => (t === "ink" ? "bg-ink" : t === "say" ? "bg-prussian" : t === "moss" ? "bg-moss" : "bg-vermilion");
  return (
    <div>
      <div className="divide-y divide-rule border-y border-rule">
        {rows.map((r) => (
          <div key={r.id} className={`grid grid-cols-1 gap-2 py-3 md:grid-cols-[190px_minmax(0,1fr)_150px] md:items-center md:gap-5 ${r.dim ? "opacity-45" : ""}`}>
            <div className="text-[14px] leading-tight">{r.label}{r.sub && <div className="mt-0.5 font-mono text-[10px] text-ink/45">{r.sub}</div>}</div>
            <div className="relative h-6">
              <div className="absolute inset-y-0 left-1/2 w-px bg-ink/50" />
              <div className="absolute inset-x-0 top-1/2 h-px bg-rule" />
              {r.d?.d != null && (
                <>
                  {r.d.lo != null && r.d.hi != null && <div className="absolute top-1/2 h-[2px] -translate-y-1/2 bg-ink/25" style={{ left: x(r.d.lo), width: `${(Math.min(1, r.d.hi) - Math.max(-1, r.d.lo)) * 50}%` }} />}
                  <div className={`absolute top-1/2 h-[10px] -translate-y-1/2 ${tone(r.tone)}`} style={r.d.d >= 0 ? { left: "50%", width: `${Math.min(1, r.d.d) * 50}%` } : { left: x(r.d.d), width: `${Math.min(1, -r.d.d) * 50}%` }} />
                </>
              )}
            </div>
            <div className="font-mono text-[11.5px] md:text-right"><b className="font-semibold">{fmtPts(r.d?.d)}</b> <span className="text-ink/45">{fmtCI(r.d?.lo, r.d?.hi, true)}</span></div>
          </div>
        ))}
      </div>
      <div className="mt-1 grid grid-cols-1 md:grid-cols-[190px_minmax(0,1fr)_150px] md:gap-5">
        <div />
        <div className="flex justify-between font-mono text-[10px] text-ink/45"><span>← {leftLabel}</span><span>0</span><span>{rightLabel} →</span></div>
      </div>
    </div>
  );
}

/** The technical layer: collapsed by default, so the page reads cleanly for everyone. */
export function Details({ title = "Show the numbers", children }: { title?: string; children: React.ReactNode }) {
  return (
    <details className="group mt-6 border border-rule">
      <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 font-mono text-[11px] uppercase tracking-[0.08em] text-ink/70 hover:bg-panel">
        <span className="flex items-center gap-2"><span className="h-2 w-2 bg-ink group-open:bg-vermilion" />{title}</span>
        <span className="group-open:rotate-45">+</span>
      </summary>
      <div className="border-t border-rule px-4 py-4 text-[13.5px] leading-6 text-ink/75">{children}</div>
    </details>
  );
}

export function NumTable({ head, rows }: { head: string[]; rows: (React.ReactNode)[][] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px] font-mono text-[12px]">
        <thead><tr className="border-b border-ink text-left text-[10.5px] uppercase tracking-[0.06em] text-ink/55">{head.map((h) => <th key={h} className="py-2 pr-3 font-medium">{h}</th>)}</tr></thead>
        <tbody>{rows.map((r, i) => <tr key={i} className="border-b border-rule">{r.map((c, j) => <td key={j} className="py-2 pr-3 align-top">{c}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}
export const propCell = (p: Prop | null | undefined) => (p && p.n ? `${fmtPct(p.p)} (${p.k}/${p.n}) ${fmtCI(p.lo, p.hi)}` : "–");
export const diffCell = (d: Diff | undefined) => (d && d.d != null ? `${fmtPts(d.d)} ${fmtCI(d.lo, d.hi, true)}` : "–");

/** Section block in the page frame. */
export function Block({ id, children, className = "" }: { id?: string; children: React.ReactNode; className?: string }) {
  return <section id={id} className={`mx-auto max-w-[1200px] scroll-mt-28 border-b border-rule px-5 py-14 md:px-8 md:py-16 ${className}`}>{children}</section>;
}

/** Plain-language headline row used above every chart. */
export function ChartHead({ kicker, title, children, v }: { kicker: string; title: React.ReactNode; children?: React.ReactNode; v?: V3 }) {
  return (
    <header>
      <div className="flex flex-wrap items-center gap-3"><span className="kicker text-vermilion">{kicker}</span>{v && <PreviewTag v={v} />}</div>
      <h2 className="wide mt-3 max-w-4xl text-[28px] font-bold leading-[1.02] tracking-[-0.04em] md:text-[40px]">{title}</h2>
      {children && <div className="mt-3 max-w-3xl text-[16px] leading-relaxed text-ink/65">{children}</div>}
    </header>
  );
}

export function SubNav({ items }: { items: [string, string][] }) {
  return (
    <nav aria-label="Sections" className="sticky top-[101px] z-20 md:top-16 mx-auto max-w-[1200px] overflow-x-auto border-b border-rule bg-paper/95 backdrop-blur">
      <div className="flex min-w-max divide-x divide-rule">
        {items.map(([id, t], i) => (
          <a key={id} href={`#${id}`} className="flex items-center gap-2 px-4 py-3 font-mono text-[11px] uppercase tracking-[0.06em] text-ink/65 hover:bg-panel hover:text-ink md:px-5">
            <span className="text-ink/35">{String(i + 1).padStart(2, "0")}</span>{t}
          </a>
        ))}
      </div>
    </nav>
  );
}
