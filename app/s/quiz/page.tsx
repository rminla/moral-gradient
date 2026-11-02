import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PreviewBanner, PreviewTag } from "@/components/V3";
import QuizClient from "@/components/QuizClient";
import { quizProps } from "@/lib/quiz";
import { QUIZ, TWIN_HEADLINE } from "@/lib/quizItems";
import { WRAPPER, parseQuizShare } from "@/lib/shareCopy";
import { SITE_NAME } from "@/lib/config";

export const dynamic = "force-dynamic";

type SP = Promise<{ m?: string; s?: string }>;

/** Landing page for an opted-in shared result. Only a whitelisted model slug and a 0–100 score are accepted; nothing is stored. */
export async function generateMetadata({ searchParams }: { searchParams: SP }): Promise<Metadata> {
  const sp = await searchParams;
  const r = parseQuizShare(sp.m, sp.s);
  if (!r) return { title: "Not found", robots: { index: false, follow: false } };
  const title = `${TWIN_HEADLINE(r.name)} (${r.score}% match)`;
  const ogTitle = `${WRAPPER} ${TWIN_HEADLINE(r.name)}.`;
  const description = `Which AI model are you most like? ${QUIZ.length} quick moral dilemmas, no right answers. Final v3 results, just for fun.`;
  const image = { url: `/s/quiz/og?m=${r.slug}&s=${r.score}`, width: 1200, height: 630, alt: `${TWIN_HEADLINE(r.name)}, ${r.score}% match, on ${SITE_NAME}.` };
  return {
    title, description, robots: { index: false, follow: true },
    alternates: { canonical: "/quiz" },
    openGraph: { type: "website", siteName: SITE_NAME, url: `/s/quiz?m=${r.slug}&s=${r.score}`, title: ogTitle, description, images: [image] },
    twitter: { card: "summary_large_image", title: ogTitle, description, images: [image] },
  };
}

export default async function SharedQuiz({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const r = parseQuizShare(sp.m, sp.s);
  if (!r) notFound();
  const { v, rates, taglines } = await quizProps();
  return (
    <main>
      <PreviewBanner v={v} />
      <section className="mx-auto max-w-[1200px] border-b border-rule bg-panel px-5 py-5 md:px-8">
        <div className="label">Someone shared their result</div>
        <p className="mt-1 text-[17px] leading-relaxed">&ldquo;{TWIN_HEADLINE(r.name)}&rdquo; <span className="num text-ink/60">· {r.score}% match</span></p>
        {taglines[r.id] && <p className="mt-1 text-[14px] leading-6 text-ink/60">{taglines[r.id]}</p>}
        <p className="mt-2 text-[12.5px] text-ink/45">This came from the link they shared. We don&apos;t store results. Who&apos;s yours?</p>
      </section>
      <QuizClient rates={rates} taglines={taglines} nModels={Object.keys(rates).length} final={v.status === "final"} previewTag={<PreviewTag v={v} />} />
    </main>
  );
}
