import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { QUIZ_V4_NEW } from "@/lib/quizV4ItemsNew";
import { MODELS, getModelResults } from "@/lib/quizV4MeasuredData";
import { SITE_NAME } from "@/lib/config";

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

  // Calculate model agreement
  const modelAgreement = MODELS.map(model => {
    const result = getModelResults(model.id, item.id);
    if (!result) return null;
    
    const userChoiceCount = result.optionCounts[a] || 0;
    const agreement = result.validCount > 0 ? Math.round((userChoiceCount / result.validCount) * 100) : 0;
    const agreed = agreement >= 50;
    return { agreed };
  }).filter(Boolean);

  const agreedCount = modelAgreement.filter(m => m?.agreed).length;
  const agreementText = agreedCount === 4 ? "All 4 models agreed" : agreedCount === 0 ? "None of the 4 models agreed" : `${agreedCount} of 4 models agreed`;

  // Build absolute URLs for OG image
  const baseUrl = process.env.VERCEL_URL 
    ? `https://${process.env.VERCEL_URL}` 
    : process.env.NODE_ENV === "production"
    ? "https://moral-gradient.vercel.app"
    : "http://localhost:3000";

  const title = `${item.title}: ${answerLabel}`;
  const description = `${agreementText}. A classic moral dilemma on ${SITE_NAME}.`;
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

  // Redirect to the main quiz page (visitors land on the quiz, not a static result page)
  redirect("/quiz-v4");
}
