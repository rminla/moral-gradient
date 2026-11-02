import { SITE_NAME } from "@/lib/config";

/** Kept for share images and legacy callers: words (grey) → deeds (signal red). */
export const SCALE = ["#0c0c0d", "#3a3b3e", "#6c6f75", "#a5a8ad", "#ff8b74", "#ff5a3d", "#ff3d1f"];

/**
 * The mark: "Where it lands". A stepped scale from words (ink, grey) to deeds (red), with a pointer marking
 * where a model actually lands: off-centre, one step short of full red.
 * Two drawings: the full mark (48-unit grid, five cells, triangular pointer) above 32px, and a favicon-optimised
 * one (16-unit grid, four gapless cells, pointer stepped in whole units, every edge on the pixel grid) at 32px and below.
 */
export const MARK_FULL = {
  cells: [4, 12.25, 20.5, 28.75, 37].map((x) => ({ x, y: 20, w: 7.25, h: 24 })),
  pointer: "M25.875 4H38.875L32.375 15Z",
};
export const MARK_SMALL = {
  cells: [0, 4, 8, 12].map((x) => ({ x, y: 8, w: 4, h: 8 })),
  pointer: "M6 2h8v1h-1v1h-1v1h-1v1h-2v-1h-1v-1h-1v-1h-1Z",
};
export function Mark({ size = 22, className = "", light = false }: { size?: number; className?: string; light?: boolean }) {
  const small = size <= 32;
  const fg = light ? "#ffffff" : "#0c0c0d";
  const fills = small
    ? [fg, light ? "#a5a8ad" : "#6c6f75", "#ff8b74", "#ff3d1f"]
    : [fg, light ? "#d4d5d8" : "#3a3b3e", light ? "#a5a8ad" : "#6c6f75", "#ff8b74", "#ff3d1f"];
  const p = small ? MARK_SMALL : MARK_FULL;
  return (
    <svg viewBox={small ? "0 0 16 16" : "0 0 48 48"} width={size} height={size} className={className} aria-hidden="true">
      {p.cells.map((c, i) => <rect key={i} x={c.x} y={c.y} width={c.w} height={c.h} fill={fills[i]} />)}
      <path d={p.pointer} fill={fg} />
    </svg>
  );
}

export function Wordmark({ className = "", size = "text-[17px]" }: { className?: string; size?: string }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <Mark size={24} />
      <span className={`wide ${size} font-bold uppercase leading-none tracking-[-0.01em]`}>{SITE_NAME}</span>
    </span>
  );
}

/** Signature divider (A): a strip of 20 run-cells, words grey, deeds red. */
export function GradientRule({ left, right, className = "", dark = false }: { left?: string; right?: string; className?: string; dark?: boolean }) {
  return (
    <div className={className}>
      <div className="grid grid-cols-[repeat(20,minmax(0,1fr))] gap-[3px]">
        {Array.from({ length: 20 }, (_, i) => <span key={i} className={`h-2 ${i < 10 ? (dark ? "bg-white/85" : "bg-ink/80") : i < 14 ? "bg-prussian-2" : "bg-vermilion"}`} />)}
      </div>
      {(left || right) && (
        <div className={`mt-2 flex justify-between font-mono text-[10.5px] uppercase tracking-[0.08em] ${dark ? "text-white/45" : "text-ink/55"}`}>
          <span>← {left}</span><span>{right} →</span>
        </div>
      )}
    </div>
  );
}

const PILLAR: Record<string, { name: string; color: string; text: string }> = {
  saydo: { name: "Say vs Do", color: "bg-vermilion", text: "text-vermilion" },
  pressure: { name: "Under pressure", color: "bg-ink", text: "text-ink" },
  selfinterest: { name: "Self-interest", color: "bg-prussian", text: "text-prussian" },
  baseline: { name: "Baseline", color: "bg-ink", text: "text-ink" },
};
export const pillar = (k: string) => PILLAR[k] || { name: k, color: "bg-ink", text: "text-ink" };

export function Kicker({ k, children }: { k?: string; children?: React.ReactNode }) {
  const p = k ? pillar(k) : null;
  return <span className={`kicker ${p ? p.text : "text-ink/60"}`}>{children ?? p?.name}</span>;
}

/** Pill eyebrow with a signal dot. */
export function Eyebrow({ children, dark = false }: { children: React.ReactNode; dark?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 font-mono text-[10.5px] uppercase tracking-[0.08em] ${dark ? "border-white/15 text-white/80" : "border-rule text-ink/75"}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-vermilion" />{children}
    </span>
  );
}

export function SectionHead({ n, kicker, title, children, id }: { n?: string; kicker?: string; title: React.ReactNode; children?: React.ReactNode; id?: string }) {
  return (
    <header id={id} className="scroll-mt-24 pt-2">
      {(kicker || n) && <Eyebrow>{n ? `${n} · ` : ""}{kicker}</Eyebrow>}
      <h2 className="wide mt-4 text-[30px] font-bold leading-[1] tracking-[-0.04em] md:text-[44px]">{title}</h2>
      {children && <div className="mt-3 max-w-2xl text-[16px] leading-relaxed text-ink/60">{children}</div>}
    </header>
  );
}

/** Page-width frame that lines up with the nav rails. */
export function Frame({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`mx-auto max-w-[1200px] px-5 md:px-8 ${className}`}>{children}</div>;
}

/** Signal page header: pixel-grid cell, pill eyebrow, big expanded headline (optional grey lead-in). */
export function PageHead({ eyebrow, title, grey, children, aside, center = false }: { eyebrow?: React.ReactNode; title: React.ReactNode; grey?: React.ReactNode; children?: React.ReactNode; aside?: React.ReactNode; center?: boolean }) {
  return (
    <section className="relative mx-auto max-w-[1200px] overflow-hidden border-b border-rule">
      <div aria-hidden className="pixel-grid absolute inset-0 [mask-image:linear-gradient(to_bottom,black,transparent_85%)]" />
      <span aria-hidden className="absolute right-[57px] top-[57px] hidden h-[27px] w-[27px] bg-vermilion md:block" />
      <div className={`relative grid gap-8 px-5 pb-12 pt-12 md:px-8 md:pb-16 md:pt-16 ${aside ? "md:grid-cols-[minmax(0,1fr)_340px] md:items-end" : ""} ${center ? "text-center" : ""}`}>
        <div className="rise min-w-0">
          {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
          <h1 className={`wide mt-6 max-w-[920px] text-[38px] font-bold leading-[0.96] tracking-[-0.045em] md:text-[64px] ${center ? "mx-auto" : ""}`}>
            {grey && <span className="text-ink/35">{grey} </span>}{title}
          </h1>
          {children && <div className={`mt-6 max-w-2xl text-[17px] leading-relaxed text-ink/65 ${center ? "mx-auto" : ""}`}>{children}</div>}
        </div>
        {aside && <div className="min-w-0">{aside}</div>}
      </div>
    </section>
  );
}
