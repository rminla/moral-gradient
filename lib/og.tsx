import fs from "node:fs/promises";
import path from "node:path";
import { SITE_URL } from "./config";

/** Signal fonts for next/og (static TTF instances in assets/fonts, OFL). Missing files fall back to the default font. */
export async function ogFonts() {
  const dir = path.join(process.cwd(), "assets", "fonts");
  const spec = [
    { file: "Archivo-Expanded-ExtraBold.ttf", name: "Archivo Expanded", weight: 800 as const },
    { file: "Archivo-Regular.ttf", name: "Archivo", weight: 400 as const },
    { file: "Archivo-SemiBold.ttf", name: "Archivo", weight: 600 as const },
    { file: "JetBrainsMono-Medium.ttf", name: "JetBrains Mono", weight: 500 as const },
  ];
  const out = [];
  for (const s of spec) {
    try { out.push({ name: s.name, data: await fs.readFile(path.join(dir, s.file)), weight: s.weight, style: "normal" as const }); } catch { /* fall back */ }
  }
  return out;
}

export const OG = { paper: "#ffffff", panel: "#f4f4f3", ink: "#0c0c0d", rule: "#e3e3e1", signal: "#ff3d1f", grey: "#6c6f75", grey2: "#a5a8ad", muted: "#8a8c90" };
export const PILLAR_OG: Record<string, { name: string; color: string }> = {
  saydo: { name: "Say vs Do", color: OG.signal }, pressure: { name: "Under pressure", color: OG.ink },
  selfinterest: { name: "Self-interest", color: OG.signal }, baseline: { name: "Baseline", color: OG.ink },
};
export const siteHost = () => { try { return new URL(SITE_URL).host; } catch { return "moralgradient.org"; } };

/** The "Tipping point" mark (full drawing; share images are large). Paths mirror MARK_FULL in components/Brand.tsx. */
export function OgMark({ size = 34, light = false }: { size?: number; light?: boolean }) {
  const fg = light ? "#fff" : OG.ink;
  return (
    <svg width={size} height={size} viewBox="0 0 48 48">
      <path d="M7.26 11.49 L15.99 13.67 L13.81 22.4 L5.08 20.22 Z" fill={light ? OG.grey2 : OG.grey} />
      <path d="M33.45 13.9 L46.06 17.04 L42.92 29.66 L30.31 26.51 Z" fill={OG.signal} />
      <path d="M24 29 L33 44 L15 44 Z" fill={fg} />
      <path d="M3.14 19.74 L45.83 30.38 L44.86 34.26 L2.17 23.62 Z" fill={fg} />
    </svg>
  );
}

export function OgWordmark({ size = 26, light = false }: { size?: number; light?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
      <OgMark size={size} light={light} />
      <div style={{ display: "flex", fontFamily: "Archivo Expanded", fontSize: size * 0.82, letterSpacing: -0.5, color: light ? "#fff" : OG.ink }}>MORAL GRADIENT</div>
    </div>
  );
}

/** A 20-cell strip; `value` 0..1 fills cells in `color`. */
export function OgCells({ value, color = OG.ink, w = 420, h = 22, empty = OG.panel }: { value: number; color?: string; w?: number; h?: number; empty?: string }) {
  const gap = 3, cw = (w - gap * 19) / 20, filled = Math.round(Math.min(1, Math.max(0, value)) * 20);
  return <div style={{ display: "flex", gap, width: w }}>{Array.from({ length: 20 }, (_, i) => <div key={i} style={{ width: cw, height: h, background: i < filled ? color : empty }} />)}</div>;
}
