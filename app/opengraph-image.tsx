import { ImageResponse } from "next/og";
import { OG, OgCells, OgWordmark, ogFonts, siteHost } from "@/lib/og";

export const runtime = "nodejs";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Moral Gradient: AI models say one thing. We track what they do. Open data, written for everyone.";

export default async function Image() {
  const fonts = await ogFonts();
  const head = { display: "flex", fontFamily: "Archivo Expanded", fontSize: 72, lineHeight: 1.0, letterSpacing: -3 } as const;
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: OG.paper, color: OG.ink, fontFamily: "Archivo", position: "relative" }}>
        <div style={{ position: "absolute", top: 0, right: 0, width: 330, height: 630, display: "flex", flexDirection: "column", justifyContent: "center", gap: 18, padding: "0 48px", background: OG.ink }}>
          {[["Says it's right", 0.95, OG.grey2], ["Tells others to", 0.85, OG.grey], ["Actually does", 0.35, OG.signal]].map(([l, v, c]) => (
            <div key={l as string} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 17, color: "rgba(255,255,255,0.7)" }}><span>{l as string}</span><span style={{ fontFamily: "JetBrains Mono", color: c === OG.signal ? OG.signal : "#fff" }}>{Math.round((v as number) * 100)}%</span></div>
              <OgCells value={v as number} color={c as string} w={234} h={14} empty="rgba(255,255,255,0.12)" />
            </div>
          ))}
          <div style={{ display: "flex", fontFamily: "JetBrains Mono", fontSize: 12, color: "rgba(255,255,255,0.4)", marginTop: 6, letterSpacing: 1 }}>ILLUSTRATIVE · ONE CELL = 5%</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", flex: 1, width: 870, padding: "50px 60px 44px" }}>
          <OgWordmark size={30} />
          <div style={{ display: "flex", marginTop: 54, alignItems: "center", gap: 10, fontFamily: "JetBrains Mono", fontSize: 16, letterSpacing: 2, color: OG.grey }}>
            <div style={{ width: 10, height: 10, background: OG.signal }} />AN OPEN RESEARCH TRACKER
          </div>
          <div style={{ ...head, marginTop: 22, color: "#b4b6ba" }}>AI models say</div>
          <div style={{ ...head, color: "#b4b6ba" }}>one thing.</div>
          <div style={{ ...head }}>We track what</div>
          <div style={{ ...head, gap: 22 }}><span>they</span><span style={{ color: OG.signal }}>do.</span></div>
          <div style={{ display: "flex", flex: 1 }} />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: `1px solid ${OG.rule}`, paddingTop: 16, fontSize: 19, color: OG.grey }}>
            <span>Open data, written for everyone. Try it, learn, talk about it.</span>
            <span style={{ fontFamily: "JetBrains Mono", fontSize: 17, color: OG.ink }}>{siteHost()}</span>
          </div>
        </div>
      </div>
    ),
    { ...size, fonts },
  );
}
