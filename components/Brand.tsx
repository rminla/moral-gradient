import { SITE_NAME } from "@/lib/config";

/** The diverging scale used everywhere: cool pole (Prussian) → paper neutral → warm pole (Vermilion). */
export const SCALE = ["#1d4e6e", "#4f7a93", "#9db6c2", "#e9e2d3", "#e8b4a2", "#d6735a", "#c23b1e"];

/**
 * The mark: a seven-step diverging scale with a pointer that has drifted off-centre.
 * Reads as "where a model lands between two poles" (what it says vs what it does).
 */
export function Mark({ size = 28, className = "" }: { size?: number; className?: string }) {
  const w = 7 * 4; // 7 cells, 4 units each
  return (
    <svg viewBox={`0 0 ${w} 24`} width={(size * w) / 24} height={size} className={className} aria-hidden="true">
      <path d={`M ${4 * 4 + 2 - 3} 1 h 6 l -3 4.5 z`} fill="#1a1916" />
      {SCALE.map((c, i) => <rect key={c} x={i * 4} y={8} width={4} height={14} fill={c} />)}
      <rect x={4 * 4 + 1.5} y={6.5} width={1} height={17} fill="#1a1916" />
    </svg>
  );
}

export function Wordmark({ className = "", size = "text-[22px]" }: { className?: string; size?: string }) {
  const [a, ...rest] = SITE_NAME.split(" ");
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <Mark size={22} />
      <span className={`serif ${size} leading-none tracking-[-0.01em]`}>
        {a} {rest.length > 0 && <em className="italic">{rest.join(" ")}</em>}
      </span>
    </span>
  );
}

/** Full-width diverging rule with pole labels: the brand's signature divider. */
export function GradientRule({ left, right, className = "" }: { left?: string; right?: string; className?: string }) {
  return (
    <div className={className}>
      <div className="flex h-1.5">{SCALE.map((c) => <div key={c} className="flex-1" style={{ background: c }} />)}</div>
      {(left || right) && (
        <div className="mt-1.5 flex justify-between font-sans text-[10.5px] font-medium uppercase tracking-[0.12em] text-ink/55">
          <span>← {left}</span><span>{right} →</span>
        </div>
      )}
    </div>
  );
}

const PILLAR: Record<string, { name: string; color: string; text: string }> = {
  saydo: { name: "Say vs Do", color: "bg-vermilion", text: "text-vermilion" },
  pressure: { name: "Under pressure", color: "bg-prussian", text: "text-prussian" },
  selfinterest: { name: "Self-interest", color: "bg-brass", text: "text-brass" },
  baseline: { name: "Baseline", color: "bg-ink", text: "text-ink" },
};
export const pillar = (k: string) => PILLAR[k] || { name: k, color: "bg-ink", text: "text-ink" };

export function Kicker({ k, children }: { k?: string; children?: React.ReactNode }) {
  const p = k ? pillar(k) : null;
  return <span className={`kicker ${p ? p.text : "text-ink/60"}`}>{children ?? p?.name}</span>;
}

/** Section heading in the editorial style: heavy top rule, small-caps kicker, serif title. */
export function SectionHead({ n, kicker, title, children, id }: { n?: string; kicker?: string; title: React.ReactNode; children?: React.ReactNode; id?: string }) {
  return (
    <header id={id} className="rule-head scroll-mt-20">
      <div className="flex items-baseline gap-3">
        {n && <span className="num text-xs text-ink/45">{n}</span>}
        {kicker && <span className="kicker text-ink/60">{kicker}</span>}
      </div>
      <h2 className="serif mt-1 text-[32px] leading-tight tracking-[-0.01em]">{title}</h2>
      {children && <div className="mt-2 max-w-2xl font-serif text-[17px] leading-relaxed text-ink/70">{children}</div>}
    </header>
  );
}
