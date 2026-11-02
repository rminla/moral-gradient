import { OG } from "@/lib/og";
import { OG_MONO, missionCard } from "@/lib/ogShare";
import { QUIZ, twinParts } from "@/lib/quizItems";
import { parseQuizShare } from "@/lib/shareCopy";

export const runtime = "nodejs";

/** Opted-in result card, drawn only from whitelisted params. Nothing is looked up or stored. */
export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const r = parseQuizShare(sp.get("m"), sp.get("s"));
  if (!r) return new Response("Not found", { status: 404, headers: { "x-robots-tag": "noindex" } });
  const [before, after] = twinParts();
  const res = await missionCard({
    cta: "Which AI model are you most like?",
    footer: "Compare your choices with AI models. No right answers.",
    children: (
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div style={{ display: "flex", flexDirection: "column", maxWidth: 800 }}>
          {before.trim() ? <div style={{ ...OG_MONO, color: OG.grey, display: "flex" }}>{before.trim()}</div> : null}
          <div style={{ display: "flex", marginTop: 10, fontFamily: "Archivo Expanded", fontSize: 60, letterSpacing: -2.5 }}>{r.name}</div>
          <div style={{ display: "flex", ...OG_MONO, color: OG.grey }}>{after.trim()}</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
          <div style={{ display: "flex", fontFamily: "Archivo Expanded", fontSize: 60, letterSpacing: -2 }}>{r.score}%</div>
          <div style={{ ...OG_MONO, fontSize: 15, color: OG.grey, display: "flex" }}>match · {QUIZ.length} dilemmas</div>
        </div>
      </div>
    ),
  });
  res.headers.set("x-robots-tag", "noindex");
  return res;
}
