import Link from "next/link";
import type { WeakSpot } from "@/lib/v3";
import { fmtPct, fmtPts } from "@/lib/v3";

const ICON: Record<WeakSpot["key"], string> = { pressure: "01", selfinterest: "02", aware: "03", saydo: "04", hidden: "05" };

/** "+31 pts" for differences against a comparison, "62%" for shares of runs. */
export const spotValue = (s: WeakSpot) => (s.value == null ? "–" : s.unit === "%" ? fmtPct(s.value) : fmtPts(s.value));

/** The comparison behind a number, shown on hover and keyboard focus (and as a native title for touch/long-press). */
function Baseline({ s, align = "right" }: { s: WeakSpot; align?: "left" | "right" }) {
  if (!s.base) return null;
  return (
    <span className="group/tip relative inline-flex">
      <span tabIndex={0} aria-label={`Compared with: ${s.base}`} className="flex h-4 w-4 cursor-help items-center justify-center rounded-full border border-ink/30 font-mono text-[9px] text-ink/55 outline-none hover:border-ink focus:border-ink">i</span>
      <span role="tooltip" className={`pointer-events-none absolute top-6 z-30 hidden w-[260px] border border-ink bg-paper p-3 text-left text-[12px] font-normal leading-[1.45] text-ink shadow-[4px_4px_0_rgba(12,12,13,0.12)] group-hover/tip:block group-focus-within/tip:block ${align === "right" ? "right-0" : "left-0"}`}>
        <span className="mb-1 block font-mono text-[9.5px] uppercase tracking-[0.08em] text-ink/50">{s.unit === "pts" ? "Compared with" : "Out of"}</span>
        {s.base}
        {s.ci && <span className="mt-1.5 block font-mono text-[10px] text-ink/50">95% CI {s.ci}{s.unit === "pts" ? " pts" : ""}</span>}
      </span>
    </span>
  );
}

const Unit = ({ s, className = "" }: { s: WeakSpot; className?: string }) => (s.value != null && s.unit === "pts" ? <span className={`ml-1 tracking-normal text-ink/50 ${className}`}>pts</span> : null);

/** A model's weak spots: for each behaviour, the scenario/cue where it is weakest. Points (with "pts") for differences, % for rates. */
export function WeakSpots({ spots, compact = false }: { spots: WeakSpot[]; compact?: boolean }) {
  return (
    <div className={`grid border-l border-t border-rule ${compact ? "" : "sm:grid-cols-2 lg:grid-cols-5"}`}>
      {spots.map((s) => {
        const val = spotValue(s);
        return compact ? (
          <div key={s.key} className="relative grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 border-b border-r border-rule px-3 py-2.5 hover:bg-panel">
            <Link href={s.href} className="text-[13px] font-medium leading-snug text-ink/80 hover:text-vermilion">{s.title}</Link>
            <span className="flex items-center justify-end gap-1.5">
              <span className={`num text-[15px] ${s.value == null ? "text-ink/35" : "text-vermilion"}`}>{val}<Unit s={s} className="text-[11px]" /></span>
              <Baseline s={s} />
            </span>
            {s.plain && <span className="col-span-2 mt-0.5 text-[12px] leading-[1.4] text-ink/55">{s.value != null && <span className="num text-ink/70">{val}{s.unit === "pts" ? " pts" : ""} </span>}{s.plain}<span className="text-ink/40"> · {s.where}</span></span>}
          </div>
        ) : (
          <div key={s.key} className="group relative flex flex-col border-b border-r border-rule p-5 hover:bg-panel">
            <span className="flex items-center justify-between"><span className="num text-[11px] text-ink/40">{ICON[s.key]}</span><Baseline s={s} /></span>
            <Link href={s.href} className="mt-4 text-[14.5px] font-semibold leading-snug hover:text-vermilion">{s.title}</Link>
            <span className={`num mt-3 text-[34px] leading-none tracking-[-0.04em] ${s.value == null ? "text-ink/25" : "text-vermilion"}`}>{val}<Unit s={s} className="text-[13px]" /></span>
            {s.ci && <span className="mt-1 font-mono text-[10.5px] text-ink/45">95% CI {s.ci}</span>}
            <span className="mt-3 text-[12.5px] leading-5 text-ink/60">{s.plain || s.note}</span>
            <Link href={s.href} className="mt-auto pt-4 font-mono text-[10.5px] uppercase tracking-[0.06em] text-ink/55 hover:text-vermilion">{s.where} →</Link>
          </div>
        );
      })}
    </div>
  );
}
