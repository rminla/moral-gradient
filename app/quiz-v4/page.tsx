import type { Metadata } from "next";
import QuizV4ClientNew, { PlaceholderBanner } from "@/components/QuizV4ClientNew";

// Interactive mockup on branch quiz-v4: 10 ethical dilemmas (6 classic + 4 everyday) with educational reveals
// Not linked from nav, not indexed. Model scores are fictional demo data only.
export const metadata: Metadata = {
  title: "Who's your AI ethical twin? (mockup)",
  description: "Interactive mockup: 10 ethical dilemmas with educational reveals. Model scores are fictional demo data.",
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
};

export default function QuizV4() {
  return (
    <main>
      <PlaceholderBanner />
      <QuizV4ClientNew />
    </main>
  );
}
