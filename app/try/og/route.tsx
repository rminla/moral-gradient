import { TRY_DILEMMAS } from "@/components/TryIt";
import { OG } from "@/lib/og";
import { OG_MONO, missionCard } from "@/lib/ogShare";

export const runtime = "nodejs";

/** Share card for one dilemma: mission wrapper + the question. Never anyone's answer. */
export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get("d") || "sw";
  const d = TRY_DILEMMAS[id] || TRY_DILEMMAS.sw;
  return missionCard({
    footer: "Answer, then see how people and AI models chose. No right answer.",
    children: (
      <div style={{ display: "flex", flexDirection: "column" }}>
        <div style={{ ...OG_MONO, color: OG.grey, display: "flex" }}>Try it yourself · {d.title}</div>
        <div style={{ display: "flex", marginTop: 14, fontFamily: "Archivo Expanded", fontSize: 52, lineHeight: 1.02, letterSpacing: -2 }}>{d.q}</div>
      </div>
    ),
  });
}
