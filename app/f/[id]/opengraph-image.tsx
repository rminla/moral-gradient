import { ImageResponse } from "next/og";
import { getBundle, modelName } from "@/lib/bundle";
import { OG, OgCells, OgWordmark, PILLAR_OG, ogFonts, siteHost } from "@/lib/og";

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
  const headline = f?.headline || "Finding";
  const hs = headline.length > 70 ? 40 : headline.length > 45 ? 48 : 56;
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: OG.paper, color: OG.ink, fontFamily: "Archivo" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "26px 56px", borderBottom: `1px solid ${OG.rule}` }}>
          <OgWordmark size={26} />
          <div style={{ display: "flex", gap: 12, alignItems: "center", fontFamily: "JetBrains Mono", fontSize: 16, letterSpacing: 1.5 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, border: `1px solid ${OG.rule}`, borderRadius: 999, padding: "6px 14px" }}><div style={{ width: 9, height: 9, background: OG.signal }} /><span>{p.name.toUpperCase()}</span></div>
            <span style={{ color: OG.grey }}>{f ? modelName(b, f.model).toUpperCase() : ""}</span>
          </div>
        </div>
        <div style={{ display: "flex", flex: 1 }}>
          <div style={{ display: "flex", flexDirection: "column", flex: 1, padding: "38px 44px 30px 56px", borderRight: `1px solid ${OG.rule}` }}>
            <div style={{ display: "flex", fontFamily: "Archivo Expanded", fontSize: hs, lineHeight: 1.02, letterSpacing: -2 }}>{headline}</div>
            <div style={{ display: "flex", flex: 1 }} />
            <div style={{ display: "flex", fontFamily: "JetBrains Mono", fontSize: 92, lineHeight: 1, letterSpacing: -4, color: OG.signal }}>{f?.stat}</div>
            <div style={{ display: "flex", fontFamily: "JetBrains Mono", fontSize: 15, letterSpacing: 1.5, color: OG.grey, marginTop: 10 }}>{(f?.stat_label || "").toUpperCase()}</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", width: 520, justifyContent: "center", gap: 22, padding: "30px 56px 30px 44px", background: OG.panel }}>
            {bars.map((x, i) => {
              const v = Math.min(1, Math.max(0, x.value ?? 0));
              const c = i === lo && gap >= 0.2 ? OG.signal : OG.ink;
              return (
                <div key={x.label} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 19 }}><span>{x.label}</span><span style={{ fontFamily: "JetBrains Mono", color: c }}>{Math.round(v * 100)}%</span></div>
                  <OgCells value={v} color={c} w={420} h={20} empty="#e3e3e1" />
                </div>
              );
            })}
            {f?.takeaway && <div style={{ display: "flex", fontSize: 18, lineHeight: 1.3, color: OG.ink, borderLeft: `4px solid ${OG.signal}`, paddingLeft: 12, marginTop: 4 }}>{f.takeaway}</div>}
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", padding: "14px 56px", background: OG.ink, color: "rgba(255,255,255,0.65)", fontSize: 16 }}>
          <span>Descriptive only: what the model did, not what it should do.</span>
          <span style={{ fontFamily: "JetBrains Mono", color: "#fff" }}>{siteHost()}</span>
        </div>
      </div>
    ),
    { ...size, fonts },
  );
}
