import { TWIN_HEADLINE } from "./quizItems";
import { MODEL_META, modelSlug } from "./v3meta";

/** Mission framing that leads every share (text, email and card). Always on. */
export const WRAPPER = "I'm helping more people understand how AI makes moral choices.";

export type QuizShare = { model: string; score: number };

export function quizPost(res: QuizShare | null) {
  const mid = res ? `I answered 7 moral dilemmas. ${TWIN_HEADLINE(res.model)} (${res.score}% match).` : "7 quick moral dilemmas: see which AI model makes choices most like yours, and how you compare with people.";
  return {
    text: `${WRAPPER} ${mid} Which AI model are you most like? No right answers.`,
    subject: res ? `${TWIN_HEADLINE(res.model)}. Who's yours?` : "Which AI model are you most like?",
    email: `${WRAPPER}\n\n${mid}\n\nIt takes about 2 minutes. There are no right answers, and nothing you pick is stored. It's part of Moral Gradient, an independent, open project that tracks what AI models do when a choice has moral weight.`,
  };
}

export function tryPost(q: string, body: string) {
  return {
    text: `${WRAPPER} ${q} Answer it, then see how people and AI models chose.`,
    subject: `A dilemma for you: ${q}`,
    email: `${WRAPPER}\n\n${q}\n\n${body}\n\nAnswer it, then see how people and AI models chose. There's no right answer, and your answer isn't stored.`,
  };
}

/** Whitelist for shared quiz results: a known model slug and an integer 0–100. Anything else is rejected. */
export function parseQuizShare(m: unknown, s: unknown): { id: string; slug: string; name: string; score: number } | null {
  if (typeof m !== "string" || typeof s !== "string" || !/^\d{1,3}$/.test(s)) return null;
  const score = Number(s);
  if (score > 100) return null;
  const hit = Object.entries(MODEL_META).find(([id]) => modelSlug(id) === m);
  return hit ? { id: hit[0], slug: m, name: hit[1].name, score } : null;
}

/** "What it thinks vs what it does": the finding, framed by the mission. No visitor data involved. */
export function thinksPost() {
  const mid = "In a simulated billing task, a budget memo made one AI model keep a customer's late fee far more often, while its note said: \"Fee recovery targets did not factor into this decision.\"";
  return {
    text: `${WRAPPER} ${mid} What AI models think vs what they do:`,
    subject: "What AI models think vs what they do",
    email: `${WRAPPER}\n\n${mid}\n\nMoral Gradient compares three things for every run: a model's reasoning, the note it writes, and what it actually does. Sometimes they don't match. It's an independent, open project; there are no right answers here, just what the models did.`,
  };
}
