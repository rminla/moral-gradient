import { NextRequest } from "next/server";
import { QUIZ_V4_NEW } from "@/lib/quizV4ItemsNew";
import { MODELS, getModelResults } from "@/lib/quizV4MeasuredData";
import { missionCard, OG_MONO } from "@/lib/ogShare";
import { OG } from "@/lib/og";

export const runtime = "nodejs";

/** Share card for a quiz question + answer: shows the question, user's choice, and model agreement */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const a = req.nextUrl.searchParams.get("a");
  
  const item = QUIZ_V4_NEW.find(q => q.id === id);
  if (!item || !a) {
    return new Response("Not found", { status: 404 });
  }

  const answerLabel = a === item.leftOptionId ? item.left : a === item.rightOptionId ? item.right : null;
  if (!answerLabel) {
    return new Response("Invalid answer", { status: 400 });
  }

  // Calculate model agreement
  const modelAgreement = MODELS.map(model => {
    const result = getModelResults(model.id, item.id);
    if (!result) return null;
    
    const userChoiceCount = result.optionCounts[a] || 0;
    const agreement = result.validCount > 0 ? Math.round((userChoiceCount / result.validCount) * 100) : 0;
    const agreed = agreement >= 50;
    return { model, agreed, agreement };
  }).filter(Boolean) as Array<{ model: typeof MODELS[0]; agreed: boolean; agreement: number }>;

  const agreedCount = modelAgreement.filter(m => m.agreed).length;
  const agreementText = agreedCount === 4 
    ? "All 4 AI models agreed with this choice" 
    : agreedCount === 0 
    ? "None of the 4 AI models agreed with this choice"
    : `${agreedCount} of 4 AI models agreed with this choice`;

  return missionCard({
    footer: "Take the quiz and find your AI ethical twin. 10 questions, about 5 minutes.",
    children: (
      <div style={{ display: "flex", flexDirection: "column" }}>
        <div style={{ ...OG_MONO, color: OG.grey, display: "flex", marginBottom: 14 }}>
          Quiz question {QUIZ_V4_NEW.indexOf(item) + 1} of {QUIZ_V4_NEW.length} · {item.title}
        </div>
        <div style={{ 
          display: "flex", 
          fontFamily: "Archivo Expanded", 
          fontSize: 44, 
          lineHeight: 1.05, 
          letterSpacing: -1.8,
          marginBottom: 24
        }}>
          {item.question}
        </div>
        <div style={{
          display: "flex",
          flexDirection: "column",
          gap: 12,
          marginTop: 12
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ 
              width: 16, 
              height: 16, 
              borderRadius: "50%", 
              background: OG.signal,
              flexShrink: 0
            }} />
            <div style={{ 
              display: "flex", 
              fontFamily: "Archivo", 
              fontSize: 26, 
              fontWeight: 600,
              color: OG.ink 
            }}>
              {answerLabel}
            </div>
          </div>
          <div style={{ 
            display: "flex", 
            fontFamily: "JetBrains Mono",
            fontSize: 17,
            textTransform: "uppercase",
            letterSpacing: 1.5,
            color: OG.grey,
            marginTop: 4
          }}>
            {agreementText}
          </div>
        </div>
      </div>
    ),
  });
}
