import Link from "next/link";
import { usd, type Funding } from "@/lib/funding";

const kindLabel = (k: string) => (k === "model" ? "the full suite on" : "the");

export function MilestoneHeadline({ f }: { f: Funding }) {
  if (!f.next)
    return <p className="text-[17px] leading-snug text-ink/80">Every queued model is funded. Donations now build the general pool ({usd(f.pool_cents)}) so the next frontier model can run the day it launches.</p>;
  return (
    <p className="text-[20px] font-medium leading-snug tracking-[-0.01em]">
      <b className="num font-semibold text-vermilion">{usd(f.next.remaining_cents)}</b> left before running {kindLabel(f.next.kind)} {f.next.title}
    </p>
  );
}

/** Signal progress: a strip of 20 square cells (5% each), filled in signal red. */
export function ProgressBar({ value, tall = false, dark = false }: { value: number; tall?: boolean; dark?: boolean }) {
  const filled = Math.round(Math.min(1, Math.max(0, value)) * 20);
  return (
    <div className="grid grid-cols-[repeat(20,minmax(0,1fr))] gap-[2px]" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(value * 100)}>
      {Array.from({ length: 20 }, (_, i) => <span key={i} className={`${tall ? "h-4" : "h-2.5"} ${i < filled ? "bg-vermilion" : dark ? "bg-white/12" : "bg-panel"}`} />)}
    </div>
  );
}

/** The dark "next model" card: one square per dollar of the next milestone. */
export function NextMilestoneCard({ f, showQueue = 3, cta = true }: { f: Funding; showQueue?: number; cta?: boolean }) {
  const next = f.next;
  const cells = next ? Math.min(400, Math.round(next.cost_cents / 100)) : 0;
  const filled = next ? Math.floor(next.funded_cents / 100) : 0;
  const cols = cells <= 50 ? 25 : 40;
  return (
    <div className="flex h-full flex-col bg-ink p-6 text-white md:p-8">
      <div className="flex items-center justify-between">
        <span className="kicker text-white/50">Next milestone</span>
        {next && <span className="num text-[12px] text-white/50">{usd(next.funded_cents, 0)} / {usd(next.cost_cents, 0)}</span>}
      </div>
      {next ? (
        <>
          <div className="wide mt-6 text-[26px] font-bold leading-none tracking-[-0.03em] md:text-[32px]">{next.title}</div>
          <div className="mt-3 text-[15px] text-white/65"><b className="num font-semibold text-vermilion">{usd(next.remaining_cents)}</b> left before {next.kind === "model" ? "the full suite runs" : "this suite runs"}</div>
          <div className="mt-6 grid gap-[3px]" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }} aria-label={`${Math.round(next.progress * 100)}% funded`}>
            {Array.from({ length: cells }, (_, i) => <span key={i} className={`aspect-square ${i < filled ? "bg-vermilion" : "bg-white/12"}`} />)}
          </div>
          <div className="mt-2 font-mono text-[10.5px] uppercase tracking-[0.06em] text-white/40">one square = $1 · launches automatically with a {usd(next.cost_cents, 0)} hard cap</div>
        </>
      ) : (
        <p className="mt-6 text-[17px] text-white/75">Every queued model is funded. Donations now build the general pool ({usd(f.pool_cents)}).</p>
      )}
      {showQueue > 0 && f.queue.length > 1 && (
        <ol className="mt-6 divide-y divide-white/10 border-y border-white/10 text-[14px]">
          {f.queue.slice(1, 1 + showQueue).map((m, i) => (
            <li key={m.key} className="flex items-baseline gap-3 py-2"><span className="num text-[11px] text-white/35">{String(i + 2).padStart(2, "0")}</span><span className="flex-1 truncate text-white/75">{m.title}</span><span className="num text-white/50">{usd(m.cost_cents, 0)}</span></li>
          ))}
        </ol>
      )}
      {cta && (
        <div className="mt-auto flex flex-wrap gap-3 pt-7">
          <Link href="/donate" className="btn-money"><span className="h-2 w-2 bg-white" />Donate</Link>
          <Link href="/costs#queue" className="btn border-white/20 text-white hover:border-white">Full queue</Link>
        </div>
      )}
    </div>
  );
}
