import { ImageResponse } from "next/og";
import { OG, OgCells, OgWordmark, ogFonts, siteHost } from "./og";
import { WRAPPER } from "./shareCopy";

export const OG_MONO = { fontFamily: "JetBrains Mono", fontSize: 17, letterSpacing: 2, textTransform: "uppercase" } as const;

/** 1200×630 share card: the mission wrapper always leads; `children` is the dilemma, the quiz, or an opted-in result. */
export async function missionCard({ children, footer, cta, preliminary = false }: { children: React.ReactNode; footer: string; cta?: string; preliminary?: boolean }) {
  const fonts = await ogFonts();
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: OG.paper, color: OG.ink, fontFamily: "Archivo", position: "relative" }}>
        <div style={{ display: "flex", position: "absolute", top: 0, left: 0 }}><OgCells value={0.75} color={OG.signal} w={1200} h={8} empty={OG.ink} /></div>
        <div style={{ display: "flex", flexDirection: "column", padding: "48px 64px 0" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <OgWordmark size={28} />
            {preliminary ? <div style={{ ...OG_MONO, fontSize: 14, display: "flex", border: `1.5px solid ${OG.ink}`, padding: "6px 10px" }}>Preliminary data</div> : <div style={{ display: "flex" }} />}
          </div>
          <div style={{ display: "flex", marginTop: 40, fontFamily: "Archivo Expanded", fontSize: 46, lineHeight: 1.06, letterSpacing: -1.6, maxWidth: 1060 }}>{WRAPPER}</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", margin: "34px 64px 0", padding: "28px 32px", background: OG.panel, borderLeft: `8px solid ${OG.ink}` }}>{children}</div>
        <div style={{ display: "flex", flex: 1 }} />
        {cta ? <div style={{ display: "flex", margin: "0 64px 22px", fontWeight: 600, fontSize: 30 }}>{cta}<span style={{ color: OG.signal, marginLeft: 12 }}>→</span></div> : null}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "0 64px 36px", borderTop: `1px solid ${OG.rule}`, paddingTop: 16, fontSize: 21, color: OG.grey }}>
          <span>{footer}</span>
          <span style={{ fontFamily: "JetBrains Mono", fontSize: 18, color: OG.ink }}>{siteHost()}</span>
        </div>
      </div>
    ),
    { width: 1200, height: 630, fonts, headers: { "cache-control": "public, max-age=3600, s-maxage=86400" } },
  );
}
