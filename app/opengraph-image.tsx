import { ImageResponse } from "next/og";
import { SITE_TAGLINE } from "@/lib/config";
import { OG, OgScaleStrip, OgWordmark, ogFonts, siteHost } from "@/lib/og";

export const runtime = "nodejs";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Moral Gradient: do AI models do what they say is right?";

export default async function Image() {
  const fonts = await ogFonts();
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: OG.paper, color: OG.ink, fontFamily: "Plex Sans" }}>
        <OgScaleStrip h={12} />
        <div style={{ display: "flex", flexDirection: "column", flex: 1, padding: "44px 64px 40px" }}>
          <OgWordmark size={40} />
          <div style={{ display: "flex", flexWrap: "wrap", fontFamily: "Newsreader", fontSize: 92, lineHeight: 1.0, letterSpacing: -2.5, marginTop: 60, maxWidth: 1000 }}>
            {SITE_TAGLINE.split(" ").map((w, i) => (
              <span key={i} style={{ marginRight: 22, ...(w === "say" ? { fontStyle: "italic", color: OG.vermilion } : {}) }}>{w}</span>
            ))}
          </div>
          <div style={{ display: "flex", flex: 1 }} />
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", height: 14 }}>{OG.scale.map((c) => <div key={c} style={{ flex: 1, background: c }} />)}</div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 12, fontSize: 18, letterSpacing: 2.5, textTransform: "uppercase", color: "#5c574d" }}>
              <span>← What it says</span><span style={{ fontFamily: "Plex Mono", letterSpacing: 0, textTransform: "none", color: OG.ink }}>{siteHost()}</span><span>What it does →</span>
            </div>
          </div>
        </div>
      </div>
    ),
    { ...size, fonts },
  );
}
