import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { QUIZ_V4_NEW } from "@/lib/quizV4ItemsNew";
import { MODELS, getModelResults } from "@/lib/quizV4MeasuredData";
import { SITE_NAME, SITE_URL } from "@/lib/config";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ a?: string }>;
};

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { id } = await params;
  const { a } = await searchParams;
  const item = QUIZ_V4_NEW.find(q => q.id === id);
  
  if (!item || !a) {
    return { title: "Quiz question not found" };
  }

  const answerLabel = a === item.leftOptionId ? item.left : a === item.rightOptionId ? item.right : null;
  if (!answerLabel) {
    return { title: "Quiz question not found" };
  }

  // Calculate model agreement with strict majority
  const modelAgreement = MODELS.map(model => {
    const result = getModelResults(model.id, item.id);
    if (!result) return null;
    
    const userOptionId = a;
    const otherOptionId = a === item.leftOptionId ? item.rightOptionId : item.leftOptionId;
    
    const matchingCount = result.optionCounts[userOptionId] || 0;
    const nonMatchingCount = result.optionCounts[otherOptionId] || 0;
    
    const agreed = matchingCount > nonMatchingCount;
    return { model, agreed };
  }).filter(Boolean) as Array<{ model: typeof MODELS[0]; agreed: boolean }>;

  const agreedCount = modelAgreement.filter(m => m.agreed).length;
  const agreementText = agreedCount === 0
    ? "None of the 4 models agreed"
    : agreedCount === 1
    ? `Only ${modelAgreement.find(m => m.agreed)?.model.displayName} agreed`
    : agreedCount === 4
    ? "All 4 models agreed"
    : `${agreedCount} of 4 models agreed`;

  // Use production URL for OG images
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || SITE_URL || "https://moral-gradient.vercel.app";

  const title = `${item.title}: ${answerLabel}`;
  const categoryLabel = item.category === "classic" ? "A classic ethical dilemma" : "An everyday moral scenario";
  const description = `${agreementText}. ${categoryLabel} on ${SITE_NAME}.`;
  const imageUrl = `${baseUrl}/quiz-v4/q/${id}/og?a=${a}`;
  const image = { url: imageUrl, width: 1200, height: 630, alt: title };

  return {
    title,
    description,
    alternates: { canonical: `/quiz-v4/q/${id}?a=${a}` },
    openGraph: { type: "website", siteName: SITE_NAME, url: `/quiz-v4/q/${id}?a=${a}`, title, description, images: [image] },
    twitter: { card: "summary_large_image", title, description, images: [image] },
  };
}

export default async function QuizQuestion({ params, searchParams }: Props) {
  const { id } = await params;
  const { a } = await searchParams;
  const item = QUIZ_V4_NEW.find(q => q.id === id);
  
  if (!item || !a) {
    notFound();
  }

  const answerLabel = a === item.leftOptionId ? item.left : a === item.rightOptionId ? item.right : null;
  if (!answerLabel) {
    notFound();
  }

  const questionIndex = QUIZ_V4_NEW.findIndex(q => q.id === id);

  return (
    <main className="border-b border-rule">
      <div className="mx-auto max-w-[920px] px-6 py-12 md:px-8 md:py-16">
        <div className="kicker text-vermilion">QUESTION {questionIndex + 1} OF {QUIZ_V4_NEW.length} · {item.title.toUpperCase()}</div>
        <h1 className="mt-6 text-[32px] font-bold leading-tight tracking-tight md:text-[40px]">{item.question}</h1>
        
        <div className="mt-8 space-y-4">
          {item.scenario.split('\n\n').map((para, i) => (
            <p key={i} className="text-[17px] leading-relaxed text-ink/80">{para}</p>
          ))}
        </div>

        <div className="mt-10 rounded border border-ink/20 bg-highlight/10 p-6">
          <div className="label !mb-2">SHARED ANSWER</div>
          <div className="text-[24px] font-semibold leading-snug">{answerLabel}</div>
          <p className="mt-3 text-[14px] leading-6 text-ink/65">
            Someone answered this question and shared it with you. Take the full quiz to see how AI models responded to all {QUIZ_V4_NEW.length} dilemmas.
          </p>
        </div>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/quiz-v4" className="btn-primary">
            Take the quiz
          </Link>
          <Link href={`/quiz-v4?start=${questionIndex}`} className="btn-ghost">
            Start at this question
          </Link>
        </div>

        <div className="mt-12 space-y-6 border-t border-rule pt-8">
          <div>
            <div className="label !mb-2 !text-ink/45">BACKGROUND</div>
            <p className="text-[14px] leading-relaxed text-ink/65">{item.background}</p>
            {item.sourceUrl && (
              <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer" className="link mt-2 inline-block text-[13px]">
                Learn more →
              </a>
            )}
          </div>
          <div>
            <div className="label !mb-2 !text-ink/45">WHY IT MATTERS FOR AI</div>
            <p className="text-[14px] leading-relaxed text-ink/65">{item.aiRelevance}</p>
          </div>
        </div>
      </div>
    </main>
  );
}
