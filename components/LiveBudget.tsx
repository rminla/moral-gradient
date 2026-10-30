"use client";
import { useEffect, useState } from "react";

type S = { raised_usd: number; pool_usd: number; spent_usd: number | null; spend_source: string | null; spend_as_of: string | null; donors: number };
const fmt = (v: number | null | undefined, d = 2) => (v == null ? "–" : `$${v.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d })}`);

/** Polls /api/status every 20s so spend from the cost ledger shows up within a minute. */
export default function LiveBudget({ initial }: { initial: S }) {
  const [s, setS] = useState(initial);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(async () => {
      try { const r = await fetch("/api/status", { cache: "no-store" }); if (r.ok) { setS(await r.json()); setTick((x) => x + 1); } } catch {}
    }, 20000);
    return () => clearInterval(t);
  }, []);
  const items = [
    { k: "Spent on model calls", v: fmt(s.spent_usd, 2), hint: s.spend_source === "live-ledger" ? "live from the cost ledger" : "last synced" },
    { k: "Raised from donors", v: fmt(s.raised_usd, 2), hint: `${s.donors} donor${s.donors === 1 ? "" : "s"}` },
    { k: "Unallocated pool", v: fmt(s.pool_usd, 2), hint: "waiting for the next milestone" },
  ];
  return (
    <div className="card p-5">
      <div className="mb-4 flex items-center justify-between border-b border-ink/15 pb-2">
        <div className="kicker text-ink">The ledger</div>
        <span className="flex items-center gap-1.5 font-sans text-[11px] text-ink/50"><span key={tick} className="h-1.5 w-1.5 animate-pulse rounded-full bg-vermilion" />live · every 20 s</span>
      </div>
      <dl className="grid grid-cols-3 divide-x divide-ink/15">
        {items.map((i, n) => (
          <div key={i.k} className={n === 0 ? "pr-3" : "px-3"}>
            <dd className="num text-[22px] font-medium leading-none">{i.v}</dd>
            <dt className="mt-2 font-sans text-xs font-medium text-ink/80">{i.k}</dt>
            <div className="font-sans text-[11px] text-ink/45">{i.hint}</div>
          </div>
        ))}
      </dl>
      {s.spend_as_of && <div className="mt-4 font-sans text-[11px] text-ink/45">Last model call: {new Date(s.spend_as_of).toLocaleString("en-US", { timeZone: "America/Los_Angeles", dateStyle: "medium", timeStyle: "short" })} PT</div>}
    </div>
  );
}
