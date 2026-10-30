import { paymentsMode } from "@/lib/config";

export function ExampleBanner({ example, examplesInLedger, exploratory }: { example: boolean; examplesInLedger?: boolean; exploratory?: boolean }) {
  const mock = paymentsMode() === "mock";
  if (!example && !mock && !examplesInLedger && !exploratory) return null;
  return (
    <div className="border-b border-amber-300/60 bg-amber-50 text-amber-900">
      <div className="mx-auto max-w-6xl px-5 py-2 text-xs">
        <b>Preview build.</b>{" "}
        {example && "Results shown are EXAMPLE DATA built from the single-model pilot (Claude Haiku 5.5), not a published wave. "}
        {!example && exploratory && "Pilot results: one model (Claude Haiku 5.5), exploratory and not yet preregistered. Superseded and excluded runs are listed but never charted. "}
        {examplesInLedger && "The donation leaderboard includes example donations. "}
        {mock && "Payments run in mock mode: no card is charged."}
      </div>
    </div>
  );
}

export function ExampleTag({ show = true, children = "Example data" }: { show?: boolean; children?: React.ReactNode }) {
  if (!show) return null;
  return <span className="inline-flex items-center rounded-md bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-800">{children}</span>;
}
