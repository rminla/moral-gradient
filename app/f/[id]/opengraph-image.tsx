import { ImageResponse } from "next/og";
import { getBundle, modelName } from "@/lib/bundle";
import { SITE_NAME } from "@/lib/config";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Finding";

const COLORS: Record<string, string> = { saydo: "#7c3aed", pressure: "#0284c7", selfinterest: "#d97706", baseline: "#12141a" };

export default async function OG({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const b = await getBundle();
  const f = b.findings.find((x) => x.id === id);
  const accent = COLORS[f?.pillar || "saydo"] || "#12141a";
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: "#f6f4ef", padding: 56, fontFamily: "sans-serif", color: "#12141a" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 26 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: "#12141a", color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, fontWeight: 800 }}>{SITE_NAME.replace(/^The /, "").charAt(0)}</div>
          <div style={{ fontWeight: 700 }}>{SITE_NAME}</div>
          <div style={{ marginLeft: "auto", display: "flex", padding: "6px 16px", borderRadius: 999, background: accent, color: "white", fontSize: 22 }}>{f ? modelName(b, f.model) : ""}</div>
        </div>
        <div style={{ display: "flex", flex: 1, gap: 48, marginTop: 36 }}>
          <div style={{ display: "flex", flexDirection: "column", flex: 1.1 }}>
            <div style={{ fontSize: 56, fontWeight: 800, lineHeight: 1.08, letterSpacing: -1 }}>{f?.headline || "Finding"}</div>
            <div style={{ fontSize: 76, fontWeight: 800, marginTop: 24, color: accent }}>{f?.stat}</div>
            <div style={{ fontSize: 26, color: "#555" }}>{f?.stat_label}</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", flex: 0.9, justifyContent: "center", gap: 20 }}>
            {(f?.bars || []).slice(0, 4).map((x) => (
              <div key={x.label} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 22 }}><span>{x.label}</span><span style={{ fontWeight: 700 }}>{Math.round((x.value || 0) * 100)}%</span></div>
                <div style={{ display: "flex", height: 18, borderRadius: 9, background: "#e7e3da" }}>
                  <div style={{ display: "flex", width: `${Math.max(2, (x.value || 0) * 100)}%`, height: 18, borderRadius: 9, background: accent }} />
                </div>
              </div>
            ))}
          </div>
        </div>
        <div style={{ display: "flex", fontSize: 20, color: "#777", marginTop: 12 }}>
          {b.is_example ? "Example data from the single-model pilot · " : "Pilot, exploratory · "}Descriptive only: what the model did, not what it should do.
        </div>
      </div>
    ),
    size,
  );
}
