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

  // Calculate model agreement for chip states
  const modelChips = MODELS.map(model => {
    const result = getModelResults(model.id, item.id);
    if (!result) return null;
    
    const userChoiceCount = result.optionCounts[a] || 0;
    const agreement = result.validCount > 0 ? Math.round((userChoiceCount / result.validCount) * 100) : 0;
    const agreed = agreement >= 50;
    const tie = agreement === 50;
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
          padding: "48px 52px",
          flex: 1,
        }}>
          {/* Question title + setup */}
          <div style={{
            display: "flex",
            flexDirection: "column",
            gap: 16,
            borderBottom: `1px solid ${OG.rule}`,
            paddingBottom: 24,
          }}>
            <div style={{
              display: "flex",
              fontFamily: "JetBrains Mono",
              fontSize: 16,
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
              fontSize: 24,
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
            gap: 8,
            marginTop: 28,
          }}>
            <div style={{
              display: "flex",
              fontFamily: "JetBrains Mono",
              fontSize: 14,
              textTransform: "uppercase",
              letterSpacing: 1.2,
              color: OG.grey,
            }}>
              I would:
            </div>
            <div style={{
              display: "flex",
              fontFamily: "Archivo Expanded",
              fontSize: 38,
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
            marginTop: 26,
            paddingTop: 26,
            borderTop: `1px solid ${OG.rule}`,
            flexWrap: "wrap",
          }}>
            {modelChips.map(({ chipName, state }) => {
              const chipColor = state === "yes" ? OG.signal : OG.grey;
              const textColor = state === "no" ? OG.grey : OG.ink;
              const mark = state === "yes" ? "✓" : state === "tie" ? "=" : "×";
              
              return (
                <div key={chipName} style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "6px 12px",
                  border: `1px solid ${OG.rule}`,
                  background: "transparent",
                }}>
                  <span style={{
                    fontFamily: "JetBrains Mono",
                    fontSize: 15,
                    fontWeight: 500,
                    color: chipColor,
                    width: 14,
                    textAlign: "center",
                  }}>
                    {mark}
                  </span>
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
            marginTop: "auto",
            paddingTop: 32,
          }}>
            <div style={{
              display: "flex",
              fontFamily: "Archivo Expanded",
              fontSize: 28,
              fontWeight: 800,
              color: OG.ink,
            }}>
              What would you do?
            </div>
          </div>
        </div>

        {/* Footer with wordmark */}
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "20px",
          borderTop: `1px solid ${OG.rule}`,
          background: OG.paper,
        }}>
          <OgWordmark size={20} />
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
