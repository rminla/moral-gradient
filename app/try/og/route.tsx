import { ImageResponse } from "next/og";
import { TRY_DILEMMAS } from "@/components/TryIt";
import { OG, OgCells, OgWordmark, ogFonts, siteHost } from "@/lib/og";

export const runtime = "nodejs";

/** 1200×630 share card for one dilemma. Shows the question only, never anyone's answer or results. */
export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get("d") || "sw";
  const d = TRY_DILEMMAS[id] || TRY_DILEMMAS.sw;
  const fonts = await ogFonts();
  const btn = { display: "flex", alignItems: "center", justifyContent: "space-between", width: 330, padding: "20px 26px", border: `2px solid ${OG.ink}`, fontFamily: "JetBrains Mono", fontSize: 22, letterSpacing: 2, textTransform: "uppercase" } as const;
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: OG.paper, color: OG.ink, fontFamily: "Archivo", padding: "50px 64px 44px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <OgWordmark size={30} />
          <div style={{ display: "flex", alignItems: "center", gap: 10, fontFamily: "JetBrains Mono", fontSize: 16, letterSpacing: 2, color: OG.grey }}><div style={{ width: 10, height: 10, background: OG.signal }} />TRY IT YOURSELF · {d.title.toUpperCase()}</div>
        </div>
        <div style={{ display: "flex", marginTop: 56, fontFamily: "Archivo Expanded", fontSize: 76, lineHeight: 1.0, letterSpacing: -3, maxWidth: 1050 }}>{d.q}</div>
        <div style={{ display: "flex", gap: 18, marginTop: 44 }}>
          <div style={btn}><span>{d.yes}</span><span>→</span></div>
          <div style={btn}><span>{d.no}</span><span>→</span></div>
        </div>
        <div style={{ display: "flex", flex: 1 }} />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: `1px solid ${OG.rule}`, paddingTop: 16, fontSize: 21, color: OG.grey }}>
          <span>Answer, then see how people and AI models chose. No right answer.</span>
          <span style={{ fontFamily: "JetBrains Mono", fontSize: 18, color: OG.ink }}>{siteHost()}</span>
        </div>
        <div style={{ display: "flex", position: "absolute", top: 0, left: 0 }}><OgCells value={0.75} color={OG.signal} w={1200} h={8} empty={OG.ink} /></div>
      </div>
    ),
    { width: 1200, height: 630, fonts, headers: { "cache-control": "public, max-age=3600, s-maxage=86400" } },
  );
}
