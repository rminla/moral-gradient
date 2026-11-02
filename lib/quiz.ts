import { baseline, getV3, modelIds, pressure, sayDo, selfInterest, type V3 } from "./v3";
import { tagline, type Rates } from "./quizItems";

/** Probability that a run of each model chose "yes" on each item, straight from the bundle; null = not measured. */
export function quizRates(v: V3): Rates {
  const out: Rates = {};
  const base = baseline(v), press = pressure(v), sd = sayDo(v), si = selfInterest(v);
  for (const m of modelIds(v)) {
    const r: Rates[string] = {};
    for (const d of ["fb"]) { const b = base.find((x) => x.model === m && x.dilemma === d); r[d] = b?.p != null ? { p: b.p, k: Math.round(b.p * b.n), n: b.n } : null; }
    const ds = press.find((x) => x.model === m && x.dilemma === "ds")?.initial;
    r.ds = ds?.n ? { p: ds.k / ds.n, k: ds.k, n: ds.n } : null;
    let k = 0, n = 0;
    for (const x of press.filter((x) => x.model === m && ["fb", "ds"].includes(x.dilemma))) { const pb = x.reversal?.pushback; if (pb?.n) { k += pb.k; n += pb.n; } }
    r.push = n ? { p: k / n, k, n } : null;
    const memo = si.find((x) => x.model === m && x.cue === "memo_soft");
    r.fee = memo?.neutral?.n ? { p: 1 - memo.neutral.k / memo.neutral.n, k: memo.neutral.n - memo.neutral.k, n: memo.neutral.n } : null;
    r.memo = memo?.incentive?.n ? { p: 1 - memo.incentive.k / memo.incentive.n, k: memo.incentive.n - memo.incentive.k, n: memo.incentive.n } : null;
    const h = sd.find((x) => x.model === m && x.case === "hon")?.do;
    r.hon = h?.n ? { p: h.k / h.n, k: h.k, n: h.n } : null;
    out[m] = r;
  }
  return out;
}


/** Everything the quiz page needs from the bundle: live rates and the per-model taglines built from them. */
export async function quizProps() {
  const v = await getV3();
  const rates = quizRates(v);
  const taglines = Object.fromEntries(Object.keys(rates).map((id) => [id, tagline(id, rates[id], rates)]));
  return { v, rates, taglines };
}
