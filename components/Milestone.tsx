import Link from "next/link";
import { usd, type Funding } from "@/lib/funding";

const kindLabel = (k: string) => (k === "model" ? "the full suite on" : "the");

export function MilestoneHeadline({ f }: { f: Funding }) {
  if (!f.next)
    return (
      <p className="text-sm text-black/70">
        Every queued model is funded. Donations now build the general pool ({usd(f.pool_cents)}) so the next frontier model can run the day it launches.
      </p>
    );
  return (
    <p className="text-[15px] leading-snug">
      <b className="font-mono text-money tabular-nums">{usd(f.next.remaining_cents)}</b> left before running {kindLabel(f.next.kind)}{" "}
      <b>{f.next.title}</b>
    </p>
  );
}

export function ProgressBar({ value, tall = false }: { value: number; tall?: boolean }) {
  return (
    <div className={`relative overflow-hidden rounded-full bg-black/[0.07] ${tall ? "h-4" : "h-2.5"}`}>
      <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-money transition-[width] duration-700" style={{ width: `${Math.min(1, Math.max(0.012, value)) * 100}%` }} />
    </div>
  );
}

export function NextMilestoneCard({ f, showQueue = 3 }: { f: Funding; showQueue?: number }) {
  return (
    <div className="card p-5">
      <div className="mb-3 flex items-center justify-between">
        <div className="label !mb-0">Next milestone</div>
        {f.next && <div className="font-mono text-xs text-black/50">{usd(f.next.funded_cents, 0)} / {usd(f.next.cost_cents, 0)}</div>}
      </div>
      <MilestoneHeadline f={f} />
      <div className="mt-3"><ProgressBar value={f.next ? f.next.progress : 1} tall /></div>
      {f.next && <p className="mt-2 text-xs text-black/50">When this bar fills, the suite launches automatically with a hard spending cap of {usd(f.next.cost_cents, 0)}, and the bar moves to the next model.</p>}
      {showQueue > 0 && f.queue.length > 1 && (
        <div className="mt-4 border-t border-black/10 pt-3">
          <div className="label">Then</div>
          <ul className="space-y-1.5 text-sm">
            {f.queue.slice(1, 1 + showQueue).map((m) => (
              <li key={m.key} className="flex justify-between gap-3">
                <span className="truncate text-black/75">{m.title}</span>
                <span className="font-mono text-black/50 tabular-nums">{usd(m.cost_cents, 0)}</span>
              </li>
            ))}
          </ul>
          <Link href="/costs#queue" className="mt-2 inline-block text-xs font-semibold text-black/60 hover:text-black">Full queue →</Link>
        </div>
      )}
      <Link href="/donate" className="btn-money mt-4 w-full">Help fund it</Link>
    </div>
  );
}
