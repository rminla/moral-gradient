import { paymentsMode } from "@/lib/config";

/** Caveat banners/tags are hidden for now (pre-launch). Set NEXT_PUBLIC_SHOW_CAVEATS=1 to bring them back. */
export const SHOW_CAVEATS = process.env.NEXT_PUBLIC_SHOW_CAVEATS === "1";

export function ExampleBanner({ example, examplesInLedger, exploratory }: { example: boolean; examplesInLedger?: boolean; exploratory?: boolean }) {
  if (!SHOW_CAVEATS) return null;
  const mock = paymentsMode() === "mock";
  if (!example && !mock && !examplesInLedger && !exploratory) return null;
  return (
    <div className="border-b border-ink/15 bg-panel">
      <div className="mx-auto flex max-w-6xl items-baseline gap-3 px-5 py-2 font-sans text-xs text-ink/75">
        <span className="kicker shrink-0 bg-highlight px-1.5 py-0.5 text-ink">Preview</span>
        <span>
          {example && "Results shown are EXAMPLE DATA, not a published run. "}
          {!example && exploratory && "Preliminary results from methodology-development runs, not yet preregistered. Superseded and excluded runs are listed but never charted. "}
          {examplesInLedger && "The donation leaderboard includes example donations. "}
          {mock && "Payments run in mock mode: no card is charged."}
        </span>
      </div>
    </div>
  );
}

/** Highlighter-style annotation tag, used for caveats (example data, small samples, in progress). */
export function ExampleTag({ show = true, children = "Example data" }: { show?: boolean; children?: React.ReactNode }) {
  if (!show || !SHOW_CAVEATS) return null;
  return <span className="inline-flex items-center bg-highlight/80 px-1.5 py-px font-sans text-[10px] font-semibold uppercase tracking-[0.08em] text-ink">{children}</span>;
}
