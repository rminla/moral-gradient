import Link from "next/link";
import { usd, type Funding } from "@/lib/funding";

const kindLabel = (k: string) => (k === "model" ? "the full suite on" : "the");

export function MilestoneHeadline({ f }: { f: Funding }) {
  if (!f.next)
    return (
      <p className="font-serif text-[17px] leading-snug text-ink/80">
        Every queued model is funded. Donations now build the general pool ({usd(f.pool_cents)}) so the next frontier model can run the day it launches.
      </p>
    );
  return (
    <p className="font-serif text-[21px] leading-snug">
      <b className="num font-medium text-vermilion">{usd(f.next.remaining_cents)}</b> left before running {kindLabel(f.next.kind)}{" "}
      <span className="italic">{f.next.title}</span>
    </p>
  );
}

/** Progress as a ruler: thin track, tick marks every 10%, solid vermilion fill, no rounding. */
export function ProgressBar({ value, tall = false }: { value: number; tall?: boolean }) {
  const v = Math.min(1, Math.max(0.012, value));
  return (
    <div className={`relative ${tall ? "h-5" : "h-3"}`}>
      <div className="absolute inset-0 border border-ink/40 bg-panel" />
      <div className="absolute inset-y-0 left-0 bg-vermilion transition-[width] duration-700" style={{ width: `${v * 100}%` }} />
      {Array.from({ length: 9 }, (_, i) => (
        <div key={i} className={`absolute bottom-0 w-px bg-ink/30 ${i === 4 ? "h-full" : "h-1/2"}`} style={{ left: `${(i + 1) * 10}%` }} />
      ))}
    </div>
  );
}

export function NextMilestoneCard({ f, showQueue = 3 }: { f: Funding; showQueue?: number }) {
  return (
    <div className="card p-5">
      <div className="mb-3 flex items-center justify-between border-b border-ink/15 pb-2">
        <div className="kicker text-ink">Next milestone</div>
        {f.next && <div className="num text-xs text-ink/55">{usd(f.next.funded_cents, 0)} / {usd(f.next.cost_cents, 0)}</div>}
      </div>
      <MilestoneHeadline f={f} />
      <div className="mt-4"><ProgressBar value={f.next ? f.next.progress : 1} tall /></div>
      {f.next && <p className="mt-2 font-sans text-xs leading-5 text-ink/55">When this bar fills, the suite launches automatically with a hard spending cap of {usd(f.next.cost_cents, 0)}, and the bar moves to the next model.</p>}
      {showQueue > 0 && f.queue.length > 1 && (
        <div className="mt-4 border-t border-ink/15 pt-3">
          <div className="label">Then</div>
          <ol className="space-y-1 font-sans text-[13px]">
            {f.queue.slice(1, 1 + showQueue).map((m, i) => (
              <li key={m.key} className="flex items-baseline gap-2">
                <span className="num text-[10px] text-ink/40">{String(i + 2).padStart(2, "0")}</span>
                <span className="min-w-0 flex-1 truncate text-ink/80">{m.title}</span>
                <span className="mx-1 flex-1 border-b border-dotted border-ink/25" />
                <span className="num text-ink/60">{usd(m.cost_cents, 0)}</span>
              </li>
            ))}
          </ol>
          <Link href="/costs#queue" className="mt-2 inline-block font-sans text-xs text-ink/60 hover:text-vermilion">Full queue →</Link>
        </div>
      )}
      <Link href="/donate" className="btn-money mt-5 w-full">Help fund it</Link>
    </div>
  );
}
