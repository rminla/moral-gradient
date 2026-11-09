import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";
import { QUIZ_V4_NEW } from "@/lib/quizV4ItemsNew";
import { MODELS, getModelResults } from "@/lib/quizV4MeasuredData";

export const runtime = "edge";

const MODEL_CHIP_NAMES: Record<string, string> = {
  'anthropic/claude-haiku-5-5': 'HAIKU',
  'groq/openai/gpt-oss-120b': 'GPT-OSS',
  'groq/qwen/qwen3.6-27b': 'QWEN',
  'openrouter/google/gemini-3.8-flash': 'GEMINI',
};

const OG_INK = "#0c0c0d";
const OG_GREY = "#6c6f75";
const OG_RULE = "#e3e3e1";
const OG_PAPER = "#fafaf9";

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

  const [archivoFont, archivoExpandedFont, jetbrainsMonoFont] = await Promise.all([
    fetch(new URL("@/public/fonts/Archivo-VariableFont_wdth,wght.ttf", import.meta.url)).then(res => res.arrayBuffer()),
    fetch(new URL("@/public/fonts/ArchivoExpanded-VariableFont_wght.ttf", import.meta.url)).then(res => res.arrayBuffer()),
    fetch(new URL("@/public/fonts/JetBrainsMono-Medium.ttf", import.meta.url)).then(res => res.arrayBuffer()),
  ]);

  return new ImageResponse(
    (
      <div style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background: OG_PAPER,
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
            borderBottom: `1px solid ${OG_RULE}`,
            paddingBottom: 24,
          }}>
            <div style={{
              display: "flex",
              fontFamily: "JetBrains Mono",
              fontSize: 16,
              fontWeight: 500,
              textTransform: "uppercase",
              letterSpacing: 1.2,
              color: OG_GREY,
            }}>
              {item.title}
            </div>
            <div style={{
              display: "flex",
              fontFamily: "Archivo",
              fontSize: 24,
              lineHeight: 1.3,
              color: OG_INK,
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
              color: OG_GREY,
            }}>
              I would:
            </div>
            <div style={{
              display: "flex",
              fontFamily: "Archivo Expanded",
              fontSize: 38,
              fontWeight: 700,
              lineHeight: 1.05,
              letterSpacing: -1.5,
              color: OG_INK,
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
            borderTop: `1px solid ${OG_RULE}`,
            flexWrap: "wrap",
          }}>
            {modelChips.map(({ chipName, state }) => {
              const chipColor = state === "yes" ? "#ff3d1f" : OG_GREY;
              const textColor = state === "no" ? OG_GREY : OG_INK;
              const mark = state === "yes" ? "✓" : state === "tie" ? "=" : "×";
              
              return (
                <div key={chipName} style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "6px 12px",
                  border: `1px solid ${OG_RULE}`,
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
              fontWeight: 600,
              color: OG_INK,
            }}>
              What would you do?
            </div>
          </div>
        </div>

        {/* Footer with host */}
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "20px",
          borderTop: `1px solid ${OG_RULE}`,
          background: OG_PAPER,
        }}>
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}>
            <svg width="20" height="20" viewBox="0 0 16 16">
              <rect fill={OG_INK} height="8" width="4" x="0" y="8" />
              <rect fill={OG_GREY} height="8" width="4" x="4" y="8" />
              <rect fill="#ff8b74" height="8" width="4" x="8" y="8" />
              <rect fill="#ff3d1f" height="8" width="4" x="12" y="8" />
              <path d="M6 2h8v1h-1v1h-1v1h-1v1h-2v-1h-1v-1h-1v-1h-1Z" fill={OG_INK} />
            </svg>
            <span style={{
              fontFamily: "Archivo Expanded",
              fontSize: 16,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: -0.2,
              color: OG_INK,
            }}>
              MORAL GRADIENT
            </span>
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      fonts: [
        {
          name: "Archivo",
          data: archivoFont,
          weight: 400,
        },
        {
          name: "Archivo Expanded",
          data: archivoExpandedFont,
          weight: 700,
        },
        {
          name: "JetBrains Mono",
          data: jetbrainsMonoFont,
          weight: 500,
        },
      ],
    }
  );
}
