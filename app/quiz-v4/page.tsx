import type { Metadata } from "next";
import QuizV4Client, { PlaceholderBanner } from "@/components/QuizV4Client";

// Prototype route on branch quiz-v4: not linked from the nav, not indexed. Model numbers are placeholders.
export const metadata: Metadata = {
  title: "Quiz v4 prototype",
  description: "Prototype of the Moral Gradient quiz v4. Model numbers are placeholders.",
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
};

export default function QuizV4() {
  return (
    <main>
      <PlaceholderBanner />
      <QuizV4Client />
    </main>
  );
}
