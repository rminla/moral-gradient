import type { Bundle, Model } from "./types";

const avg = (xs: (number | null | undefined)[]) => { const v = xs.filter((x): x is number => x != null); return v.length ? v.reduce((a, z) => a + z, 0) / v.length : null; };

/** Headline numbers for one model, shared by /models and /models/[slug]. */
export function modelStats(b: Bundle, m: Model) {
  const mine = <T extends { model: string }>(xs: T[]) => xs.filter((x) => x.model === m.model_id || x.model === m.slug);
  const sd = mine(b.saydo);
  const big = sd.filter((r) => !r.sample_size_note);
  const sayAvg = avg(big.map((r) => (r.say.agree_rate == null ? null : r.say.agree_rate >= 0.5 ? r.say.agree_rate : 1 - r.say.agree_rate)));
  const judgeAvg = avg(big.map((r) => r.judge.consistent_rate));
  const doAvg = avg(big.map((r) => r.do[0]?.consistent_rate));
  const si = mine(b.selfinterest);
  const siAll = si.find((s) => !s.partial);
  const ctrl = siAll?.conditions.find((c) => c.condition === "a_none");
  const maxShift = siAll && ctrl ? Math.max(...siAll.conditions.map((c) => Math.abs(c.waive_rate - ctrl.waive_rate))) : null;
  const pr = mine(b.pressure);
  const social = avg(pr.filter((r) => !["information", "neutral_control"].includes(r.arm)).map((r) => r.flip_rate));
  const info = avg(pr.filter((r) => r.arm === "information").map((r) => r.flip_rate));
  return { mine, sd, big, sayAvg, judgeAvg, doAvg, si, maxShift, pr, social, info };
}
