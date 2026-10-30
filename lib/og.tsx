import fs from "node:fs/promises";
import path from "node:path";
import { SITE_NAME, SITE_URL } from "./config";

/** Brand fonts for next/og (static TTF instances in assets/fonts, OFL). Missing files fall back to the default font. */
export async function ogFonts() {
  const dir = path.join(process.cwd(), "assets", "fonts");
  const spec = [
    { file: "Newsreader-Display-Medium.ttf", name: "Newsreader", weight: 500 as const, style: "normal" as const },
    { file: "Newsreader-Display-MediumItalic.ttf", name: "Newsreader", weight: 500 as const, style: "italic" as const },
    { file: "IBMPlexSans-Medium.ttf", name: "Plex Sans", weight: 500 as const, style: "normal" as const },
    { file: "IBMPlexMono-Medium.ttf", name: "Plex Mono", weight: 500 as const, style: "normal" as const },
  ];
  const out = [];
  for (const s of spec) {
    try { out.push({ name: s.name, data: await fs.readFile(path.join(dir, s.file)), weight: s.weight, style: s.style }); } catch { /* fall back */ }
  }
  return out;
}

export const OG = {
  paper: "#ffffff", panel: "#f4f6f8", ink: "#12161b", rule: "#dde2e8", vermilion: "#c23b1e", prussian: "#1d4e6e", brass: "#8f6a12",
  scale: ["#1d4e6e", "#4f7a93", "#9db6c2", "#e6eaef", "#e8b4a2", "#d6735a", "#c23b1e"],
};
export const PILLAR_OG: Record<string, { name: string; color: string }> = {
  saydo: { name: "Say vs Do", color: OG.vermilion }, pressure: { name: "Under pressure", color: OG.prussian },
  selfinterest: { name: "Self-interest", color: OG.brass }, baseline: { name: "Baseline", color: OG.ink },
};
export const siteHost = () => { try { return new URL(SITE_URL).host; } catch { return "moralgradient.org"; } };

export function OgMark({ h = 34 }: { h?: number }) {
  const cell = h / 6;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", position: "relative", height: h }}>
      <div style={{ display: "flex", height: h * 0.25 }} />
      <div style={{ display: "flex" }}>{OG.scale.map((c) => <div key={c} style={{ width: cell, height: h * 0.75, background: c }} />)}</div>
      <div style={{ position: "absolute", left: cell * 4.5 - 1, top: h * 0.12, width: 2, height: h * 0.88, background: OG.ink }} />
    </div>
  );
}

export function OgWordmark({ size = 30 }: { size?: number }) {
  const [a, ...rest] = SITE_NAME.split(" ");
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
      <OgMark h={size} />
      <div style={{ display: "flex", fontFamily: "Newsreader", fontSize: size, color: OG.ink, gap: 8 }}>
        <span>{a}</span>{rest.length > 0 && <span style={{ fontStyle: "italic" }}>{rest.join(" ")}</span>}
      </div>
    </div>
  );
}

export function OgScaleStrip({ h = 10 }: { h?: number }) {
  return <div style={{ display: "flex", width: "100%", height: h }}>{OG.scale.map((c) => <div key={c} style={{ flex: 1, background: c }} />)}</div>;
}
