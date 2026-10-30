import { ImageResponse } from "next/og";
import { getBundle, modelName } from "@/lib/bundle";
import { OG, OgScaleStrip, OgWordmark, PILLAR_OG, ogFonts, siteHost } from "@/lib/og";

export const runtime = "nodejs";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Finding";

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [b, fonts] = await Promise.all([getBundle(), ogFonts()]);
  const f = b.findings.find((x) => x.id === id);
  const p = PILLAR_OG[f?.pillar || "saydo"] || PILLAR_OG.saydo;
  const bars = (f?.bars || []).slice(0, 4);
  const vals = bars.map((x) => x.value ?? 0);
  const lo = vals.length ? vals.lastIndexOf(Math.min(...vals)) : -1;
  const gap = vals.length ? Math.max(...vals) - Math.min(...vals) : 0;
  const W = 420; // chart track width
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: OG.paper, color: OG.ink, fontFamily: "Plex Sans" }}>
        <OgScaleStrip h={12} />
        <div style={{ display: "flex", flexDirection: "column", flex: 1, padding: "34px 60px 30px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: `2px solid ${OG.ink}`, paddingBottom: 18 }}>
            <OgWordmark size={32} />
            <div style={{ display: "flex", gap: 14, alignItems: "center", fontSize: 18, letterSpacing: 2.5, textTransform: "uppercase" }}>
              <span style={{ color: p.color }}>{p.name}</span><span style={{ color: "#8a939d" }}>·</span><span style={{ color: "#56606b" }}>{f ? modelName(b, f.model) : ""}</span>
            </div>
          </div>
          <div style={{ display: "flex", flex: 1, gap: 56, marginTop: 34 }}>
            <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
              <div style={{ fontFamily: "Newsreader", fontSize: 54, lineHeight: 1.04, letterSpacing: -1.5 }}>{f?.headline || "Finding"}</div>
              <div style={{ fontFamily: "Plex Mono", fontSize: 56, marginTop: 20, color: p.color }}>{f?.stat}</div>
              <div style={{ fontSize: 18, letterSpacing: 2, textTransform: "uppercase", color: "#5f6973", marginTop: 6 }}>{f?.stat_label}</div>
              {f?.takeaway && <div style={{ display: "flex", fontFamily: "Newsreader", fontStyle: "italic", fontSize: 26, lineHeight: 1.25, marginTop: 22, paddingLeft: 14, borderLeft: `3px solid ${OG.vermilion}`, color: OG.ink }}>{f.takeaway}</div>}
            </div>
            <div style={{ display: "flex", flexDirection: "column", width: W + 40, justifyContent: "center", gap: 26 }}>
              {bars.map((x, i) => {
                const v = Math.min(1, Math.max(0, x.value ?? 0));
                const c = i === lo && gap >= 0.2 ? p.color : OG.ink;
                return (
                  <div key={x.label} style={{ display: "flex", flexDirection: "column" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 20, marginBottom: 8 }}>
                      <span>{x.label}</span><span style={{ fontFamily: "Plex Mono", color: c }}>{Math.round(v * 100)}%</span>
                    </div>
                    <div style={{ display: "flex", position: "relative", width: W, height: 18 }}>
                      <div style={{ position: "absolute", left: 0, top: 0, width: 2, height: 18, background: OG.ink }} />
                      <div style={{ position: "absolute", left: W / 2, top: 0, width: 1, height: 18, background: OG.rule }} />
                      <div style={{ position: "absolute", left: W - 1, top: 0, width: 1, height: 18, background: OG.rule }} />
                      <div style={{ position: "absolute", left: 0, top: 8, width: Math.max(2, v * W), height: 3, background: c }} />
                      <div style={{ position: "absolute", left: v * W - 9, top: 0, width: 18, height: 18, borderRadius: 9, background: c, border: `3px solid ${OG.paper}` }} />
                    </div>
                  </div>
                );
              })}
              <div style={{ display: "flex", justifyContent: "space-between", width: W, fontFamily: "Plex Mono", fontSize: 14, color: "#8a939d" }}><span>0%</span><span>50%</span><span>100%</span></div>
              {f?.axis && <div style={{ display: "flex", fontSize: 16, color: "#5f6973", marginTop: -14 }}>{f.axis}</div>}
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", borderTop: `1px solid ${OG.rule}`, paddingTop: 14, fontSize: 17, color: "#5f6973" }}>
            <span>{b.is_example ? "Example data from the single-model pilot · " : "Pilot, exploratory · "}Descriptive only: what the model did, not what it should do.</span>
            <span style={{ fontFamily: "Plex Mono", color: OG.ink }}>{siteHost()}</span>
          </div>
        </div>
      </div>
    ),
    { ...size, fonts },
  );
}
