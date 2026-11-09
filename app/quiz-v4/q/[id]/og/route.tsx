import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";
import { QUIZ_V4_NEW } from "@/lib/quizV4ItemsNew";
import { MODELS, getModelResults } from "@/lib/quizV4MeasuredData";
import { ogFonts, OG, OgWordmark } from "@/lib/og";

export const runtime = "nodejs";

const MODEL_CHIP_NAMES: Record<string, string> = {
  'anthropic/claude-haiku-5-5': 'HAIKU',
  'groq/openai/gpt-oss-120b': 'GPT-OSS',
  'groq/qwen/qwen3.6-27b': 'QWEN',
  'openrouter/google/gemini-3.8-flash': 'GEMINI',
};


/** Share card for a quiz question + answer: shows question title + setup, "I would: <answer>", model chips, "What would you do?", host */
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

  // Calculate model agreement with strict majority
  const modelChips = MODELS.map(model => {
    const result = getModelResults(model.id, item.id);
    if (!result) return null;
    
    const userOptionId = a;
    const otherOptionId = a === item.leftOptionId ? item.rightOptionId : item.leftOptionId;
    
    const matchingCount = result.optionCounts[userOptionId] || 0;
    const nonMatchingCount = result.optionCounts[otherOptionId] || 0;
    
    const agreed = matchingCount > nonMatchingCount;
    const tie = matchingCount === nonMatchingCount;
    const state = tie ? "tie" : agreed ? "yes" : "no";
    
    return { chipName: MODEL_CHIP_NAMES[model.id] || model.displayName.toUpperCase(), state };
  }).filter(Boolean) as Array<{ chipName: string; state: "yes" | "no" | "tie" }>;

  // Extract first sentence or clause from scenario for the setup
  const scenarioSetup = item.scenario.split(/\.\s+/)[0] + ".";

  const fonts = await ogFonts();

  return new ImageResponse(
    (
      <div style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background: OG.paper,
        fontFamily: "Archivo",
      }}>
        <div style={{
          display: "flex",
          flexDirection: "column",
          padding: "40px 52px 32px",
          flex: 1,
        }}>
          {/* Question title + setup */}
          <div style={{
            display: "flex",
            flexDirection: "column",
            gap: 14,
            borderBottom: `1px solid ${OG.rule}`,
            paddingBottom: 20,
          }}>
            <div style={{
              display: "flex",
              fontFamily: "JetBrains Mono",
              fontSize: 15,
              fontWeight: 500,
              textTransform: "uppercase",
              letterSpacing: 1.2,
              color: OG.grey,
            }}>
              {item.title}
            </div>
            <div style={{
              display: "flex",
              fontFamily: "Archivo",
              fontSize: 22,
              lineHeight: 1.3,
              color: OG.ink,
            }}>
              {scenarioSetup}
            </div>
          </div>

          {/* "I would: <answer>" */}
          <div style={{
            display: "flex",
            flexDirection: "column",
            gap: 6,
            marginTop: 24,
          }}>
            <div style={{
              display: "flex",
              fontFamily: "JetBrains Mono",
              fontSize: 13,
              textTransform: "uppercase",
              letterSpacing: 1.2,
              color: OG.grey,
            }}>
              I would:
            </div>
            <div style={{
              display: "flex",
              fontFamily: "Archivo Expanded",
              fontSize: 36,
              fontWeight: 800,
              lineHeight: 1.05,
              letterSpacing: -1.5,
              color: OG.ink,
            }}>
              {answerLabel}
            </div>
          </div>

          {/* Model agreement chips */}
          <div style={{
            display: "flex",
            gap: 10,
            marginTop: 22,
            paddingTop: 22,
            borderTop: `1px solid ${OG.rule}`,
            flexWrap: "wrap",
          }}>
            {modelChips.map(({ chipName, state }) => {
              const chipColor = state === "yes" ? OG.signal : OG.grey;
              const textColor = state === "no" ? OG.grey : OG.ink;
              
              return (
                <div key={chipName} style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "6px 12px",
                  border: `1px solid ${OG.rule}`,
                  background: "transparent",
                }}>
                  {/* SVG check/cross/equals marks */}
                  <div style={{ width: 14, height: 14, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {state === "yes" ? (
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                        <path d="M2 6L5 9L10 3" stroke={chipColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    ) : state === "tie" ? (
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                        <path d="M2 4H10M2 8H10" stroke={chipColor} strokeWidth="2" strokeLinecap="round"/>
                      </svg>
                    ) : (
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                        <path d="M3 3L9 9M9 3L3 9" stroke={chipColor} strokeWidth="2" strokeLinecap="round"/>
                      </svg>
                    )}
                  </div>
                  <span style={{
                    fontFamily: "JetBrains Mono",
                    fontSize: 13,
                    fontWeight: 500,
                    textTransform: "uppercase",
                    letterSpacing: 0.8,
                    color: textColor,
                  }}>
                    {chipName}
                  </span>
                </div>
              );
            })}
          </div>

          {/* "What would you do?" */}
          <div style={{
            display: "flex",
            marginTop: 24,
          }}>
            <div style={{
              display: "flex",
              fontFamily: "Archivo Expanded",
              fontSize: 26,
              fontWeight: 800,
              color: OG.ink,
            }}>
              What would you do?
            </div>
          </div>
        </div>

        {/* Footer with domain */}
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "16px 20px",
          borderTop: `1px solid ${OG.rule}`,
          background: OG.paper,
        }}>
          <div style={{
            display: "flex",
            fontFamily: "JetBrains Mono",
            fontSize: 15,
            fontWeight: 500,
            color: OG.ink,
          }}>
            moral-gradient.vercel.app
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      fonts,
      headers: { "cache-control": "public, max-age=3600, s-maxage=86400" },
    }
  );
}
