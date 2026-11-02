import type { Metadata } from "next";
import { PreviewBanner, PreviewTag } from "@/components/V3";
import QuizClient from "@/components/QuizClient";
import { quizProps } from "@/lib/quiz";
import { QUIZ } from "@/lib/quizItems";
import { SITE_NAME } from "@/lib/config";

export const dynamic = "force-dynamic";

const title = "Which AI model are you most like?";
const description = `${QUIZ.length} quick moral dilemmas. Find your AI ethical twin and see how you compare with people. For fun, on preliminary data; no right answers, and nothing you pick is stored.`;
const image = { url: "/quiz/og", width: 1200, height: 630, alt: `${title} A quiz on ${SITE_NAME}.` };
export const metadata: Metadata = {
  title, description, alternates: { canonical: "/quiz" },
  openGraph: { type: "website", siteName: SITE_NAME, url: "/quiz", title, description, images: [image] },
  twitter: { card: "summary_large_image", title, description, images: [image] },
};

export default async function Quiz() {
  const { v, rates, taglines } = await quizProps();
  return (
    <main>
      <PreviewBanner v={v} />
      <QuizClient rates={rates} taglines={taglines} nModels={Object.keys(rates).length} previewTag={<PreviewTag v={v} />} />
    </main>
  );
}
