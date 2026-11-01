import Link from "next/link";
import type { WeakSpot } from "@/lib/v3";
import { fmtPct, fmtPts } from "@/lib/v3";

const ICON: Record<WeakSpot["key"], string> = { pressure: "01", selfinterest: "02", aware: "03", saydo: "04", hidden: "05" };

/** A model's weak spots: for each behaviour, the scenario/cue where it is weakest. Points for shifts, % for rates. */
export function WeakSpots({ spots, compact = false }: { spots: WeakSpot[]; compact?: boolean }) {
  return (
    <div className={`grid border-l border-t border-rule ${compact ? "" : "sm:grid-cols-2 lg:grid-cols-5"}`}>
      {spots.map((s) => {
        const isRate = s.key === "aware" || s.key === "hidden";
        const val = s.value == null ? "–" : isRate ? fmtPct(s.value) : fmtPts(s.value);
        return compact ? (
          <Link key={s.key} href={s.href} className="flex items-baseline justify-between gap-3 border-b border-r border-rule px-3 py-2 hover:bg-panel">
            <span className="text-[13px] text-ink/70">{s.title}</span>
            <span className={`num shrink-0 text-[13px] ${s.value == null ? "text-ink/35" : "text-vermilion"}`}>{val}</span>
          </Link>
        ) : (
          <Link key={s.key} href={s.href} className="group flex flex-col border-b border-r border-rule p-5 hover:bg-panel">
            <span className="num text-[11px] text-ink/40">{ICON[s.key]}</span>
            <span className="mt-4 text-[14.5px] font-semibold leading-snug">{s.title}</span>
            <span className={`num mt-3 text-[34px] leading-none tracking-[-0.04em] ${s.value == null ? "text-ink/25" : "text-vermilion"}`}>{val}{s.value != null && !isRate && <span className="ml-1 text-[13px] tracking-normal text-ink/50">pts</span>}</span>
            {s.ci && <span className="mt-1 font-mono text-[10.5px] text-ink/45">95% CI {s.ci}</span>}
            <span className="mt-3 text-[12.5px] leading-5 text-ink/60">{s.note}</span>
            <span className="mt-auto pt-4 font-mono text-[10.5px] uppercase tracking-[0.06em] text-ink/55 group-hover:text-vermilion">{s.where} →</span>
          </Link>
        );
      })}
    </div>
  );
}
