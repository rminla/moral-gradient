"use client";
import { useEffect, useState } from "react";

type S = { raised_usd: number; pool_usd: number; spent_usd: number | null; spend_source: string | null; spend_as_of: string | null; donors: number };
const fmt = (v: number | null | undefined, d = 2) => (v == null ? "–" : `$${v.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d })}`);

/** Polls /api/status every 20s so spend from the cost ledger shows up within a minute. Signal: three bordered number cells. */
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
    <div className="ticks flex h-full flex-col border border-rule bg-paper">
      <div className="flex items-center justify-between border-b border-rule px-5 py-3">
        <div className="kicker text-ink">The ledger</div>
        <span className="flex items-center gap-1.5 font-mono text-[10.5px] uppercase tracking-[0.06em] text-ink/50"><span key={tick} className="blink h-2 w-2 bg-vermilion" />live · every 20 s</span>
      </div>
      <dl className="grid flex-1 divide-y divide-rule sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        {items.map((i) => (
          <div key={i.k} className="flex flex-col p-5">
            <dd className="num text-[30px] font-medium leading-none tracking-[-0.03em]">{i.v}</dd>
            <dt className="mt-auto pt-6 text-[13px] font-semibold">{i.k}</dt>
            <div className="font-mono text-[10.5px] text-ink/45">{i.hint}</div>
          </div>
        ))}
      </dl>
      {s.spend_as_of && <div className="border-t border-rule px-5 py-2.5 font-mono text-[10.5px] text-ink/45">Last model call: {new Date(s.spend_as_of).toLocaleString("en-US", { timeZone: "UTC", dateStyle: "medium", timeStyle: "short" })} UTC</div>}
    </div>
  );
}
