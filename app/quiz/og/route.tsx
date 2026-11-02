import { OG } from "@/lib/og";
import { OG_MONO, missionCard } from "@/lib/ogShare";
import { QUIZ } from "@/lib/quizItems";

export const runtime = "nodejs";

export async function GET() {
  return missionCard({
    footer: "Compare your choices with AI models. No right answers.",
    children: (
      <div style={{ display: "flex", flexDirection: "column" }}>
        <div style={{ ...OG_MONO, color: OG.grey, display: "flex" }}>{QUIZ.length} dilemmas · about 2 minutes</div>
        <div style={{ display: "flex", marginTop: 12, fontFamily: "Archivo Expanded", fontSize: 54, lineHeight: 1.02, letterSpacing: -2 }}>Which AI model are you most like?</div>
      </div>
    ),
  });
}
