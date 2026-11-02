import { OG } from "@/lib/og";
import { OG_MONO, missionCard } from "@/lib/ogShare";
import { getV3 } from "@/lib/v3";
import { thinkRows } from "@/lib/thinks";

export const runtime = "nodejs";

/** Share card for the finding. Wrapper A leads (via missionCard); the quote is verbatim from the Haiku run. */
export async function GET() {
  const r = thinkRows(await getV3()).find((x) => x.id === "claude-haiku-5.5");
  const pts = Math.round((r?.shift?.d ?? 0) * 100);
  return missionCard({
    footer: "AI behaviour in simulated tasks. No right answers.",
    cta: "What AI models think vs what they do",
    children: (
      <div style={{ display: "flex", flexDirection: "column" }}>
        <div style={{ ...OG_MONO, color: OG.grey, display: "flex" }}>Claude Haiku 5.5 · simulated billing task</div>
        <div style={{ display: "flex", marginTop: 12, fontSize: 30, lineHeight: 1.25 }}>A budget memo made it keep the late fee {pts} points more often. Its note said:</div>
        <div style={{ display: "flex", marginTop: 10, fontFamily: "Archivo Expanded", fontSize: 32, lineHeight: 1.1, letterSpacing: -1, color: OG.signal }}>“Fee recovery targets did not factor into this decision.”</div>
      </div>
    ),
  });
}
