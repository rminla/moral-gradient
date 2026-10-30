import { ImageResponse } from "next/og";
import { OG, OgScaleStrip, OgWordmark, ogFonts, siteHost } from "@/lib/og";

export const runtime = "nodejs";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Moral Gradient: tracking what AI models do, not just what they say";

export default async function Image() {
  const fonts = await ogFonts();
  const line = { display: "flex", fontFamily: "Newsreader", fontSize: 84, lineHeight: 1.04, letterSpacing: -2.5 } as const;
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: OG.paper, color: OG.ink, fontFamily: "Plex Sans" }}>
        <OgScaleStrip h={12} />
        <div style={{ display: "flex", flexDirection: "column", flex: 1, padding: "44px 64px 40px" }}>
          <OgWordmark size={38} />
          <div style={{ ...line, marginTop: 64, color: "#8a939d" }}>What AI models say is right.</div>
          <div style={{ ...line, gap: 22 }}>
            <span>What they actually</span><span style={{ fontStyle: "italic", color: OG.vermilion }}>do.</span>
          </div>
          <div style={{ display: "flex", marginTop: 30, fontSize: 24, color: "#56606b" }}>As agents with tools, under pressure, and when they have something to gain.</div>
          <div style={{ display: "flex", flex: 1 }} />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: `2px solid ${OG.ink}`, paddingTop: 14, fontSize: 18, color: "#56606b" }}>
            <span>An open research tracker · descriptive, no right answers claimed</span>
            <span style={{ fontFamily: "Plex Mono", color: OG.ink }}>{siteHost()}</span>
          </div>
        </div>
      </div>
    ),
    { ...size, fonts },
  );
}
