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
      <div className="mb-3 flex items-center justify-between">
        <div className="label !mb-0">Budget, live</div>
        <span className="flex items-center gap-1.5 text-[11px] text-black/50"><span key={tick} className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />updates every 20 s</span>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {items.map((i) => (
          <div key={i.k}>
            <div className="font-mono text-xl font-semibold tabular-nums">{i.v}</div>
            <div className="text-xs font-medium text-black/70">{i.k}</div>
            <div className="text-[11px] text-black/45">{i.hint}</div>
          </div>
        ))}
      </div>
      {s.spend_as_of && <div className="mt-3 text-[11px] text-black/40">Last model call: {new Date(s.spend_as_of).toLocaleString("en-US", { timeZone: "America/Los_Angeles", dateStyle: "medium", timeStyle: "short" })} PT</div>}
    </div>
  );
}
