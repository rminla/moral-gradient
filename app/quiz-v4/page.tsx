import type { Metadata } from "next";
import QuizV4ClientNew from "@/components/QuizV4ClientNew";

export const metadata: Metadata = {
  title: "Who's your AI ethical twin?",
  description: "10 ethical dilemmas from classic philosophy and everyday life. See which AI model's pattern of responses is closest to yours. Based on 800 measured samples.",
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
};

export default function QuizV4() {
  return (
    <main>
      <QuizV4ClientNew />
    </main>
  );
}
