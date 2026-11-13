"""Shared statistics for v3 calibration and analysis (no model-specific logic)."""
import math
import numpy as np
from scipy.optimize import minimize
Z = 1.959964

def wilson(k, n):
    if n == 0: return (float("nan"),) * 3
    p = k / n; d = 1 + Z * Z / n; c = (p + Z * Z / (2 * n)) / d; h = Z * math.sqrt(p * (1 - p) / n + Z * Z / (4 * n * n)) / d
    return p, max(0.0, c - h), min(1.0, c + h)

def newcombe(k1, n1, k2, n2):
    """Difference p1 - p2 with Newcombe hybrid-score 95% CI."""
    if not n1 or not n2: return (float("nan"),) * 3
    p1, l1, u1 = wilson(k1, n1); p2, l2, u2 = wilson(k2, n2); d = p1 - p2
    return d, d - math.sqrt((p1 - l1) ** 2 + (u2 - p2) ** 2), d + math.sqrt((u1 - p1) ** 2 + (p2 - l2) ** 2)

def fit(x, y, ridge=0.05):
    """Ridge-penalised logistic regression P(y=1) = sigmoid(b0 + b1 x); the penalty keeps the slope finite under perfect separation."""
    x = np.asarray(x, float); y = np.asarray(y, float); xc = x.mean() if len(x) else 0.0
    def nll(b):
        z = b[0] + b[1] * (x - xc); return np.sum(np.logaddexp(0, z) - y * z) + ridge * (b[0] ** 2 + b[1] ** 2)
    b = minimize(nll, [0.0, 0.0], method="BFGS").x
    return b[0] - b[1] * xc, b[1]

def p_at(b, x): return 1 / (1 + math.exp(-(b[0] + b[1] * x)))

def tipping(x, y, lo, hi, B=1000, seed=7):
    """Level where fitted P=0.5, with a within-level bootstrap 95% CI. valid = estimate inside the ladder for >=50% of resamples."""
    x = np.asarray(x); y = np.asarray(y); rng = np.random.default_rng(seed)
    if len(x) == 0: return None
    b = fit(x, y); est = -b[0] / b[1] if abs(b[1]) > 1e-6 else float("nan")
    levels = np.unique(x); bs = []
    for _ in range(B):
        idx = np.concatenate([rng.choice(np.where(x == L)[0], size=(x == L).sum(), replace=True) for L in levels])
        c = fit(x[idx], y[idx]); bs.append(-c[0] / c[1] if abs(c[1]) > 1e-6 else np.nan)
    bs = np.array(bs, float); inr = float(np.mean((bs >= lo - 0.5) & (bs <= hi + 0.5)))
    q = np.nanpercentile(bs, [2.5, 97.5]) if np.isfinite(bs).any() else [float("nan")] * 2
    valid = bool(np.isfinite(est) and lo - 0.5 <= est <= hi + 0.5 and inr >= 0.5)
    side = None if valid else ("always above" if p_at(b, lo) > 0.5 else "always below")
    return dict(est=float(est), lo=float(max(q[0], lo - 1)), hi=float(min(q[1], hi + 1)), valid=valid, side=side, b=[float(b[0]), float(b[1])], in_range=inr)

def boot_diff(a, b, B=5000, seed=11):
    """Bootstrap CI for mean(a) - mean(b) (independent samples)."""
    a = np.asarray(a, float); b = np.asarray(b, float); rng = np.random.default_rng(seed)
    if not len(a) or not len(b): return (float("nan"),) * 3
    d = [rng.choice(a, len(a)).mean() - rng.choice(b, len(b)).mean() for _ in range(B)]
    return float(a.mean() - b.mean()), float(np.percentile(d, 2.5)), float(np.percentile(d, 97.5))

def select_levels(x, y, levels, target=0.5):
    """Pre-registered level selection for manipulations: fit the calibration ladder; if the 50% point lies inside the ladder,
    bracket it with the two adjacent integer levels (floor, ceil); otherwise use the single level whose fitted P is closest
    to 50% and flag a ceiling/floor. Never hand-picked."""
    t = tipping(x, y, min(levels), max(levels), B=400)
    b = fit(x, y)
    if t and t["valid"]:
        lo = int(math.floor(t["est"])); hi = int(math.ceil(t["est"]))
        lo = max(min(levels), min(lo, max(levels))); hi = max(min(levels), min(hi, max(levels)))
        if lo == hi: hi = min(max(levels), lo + 1) if lo < max(levels) else hi; lo = hi - 1 if lo == hi else lo
        sel = sorted({lo, hi}); flag = None
    else:
        ps = {L: p_at(b, L) for L in levels}
        if max(ps.values()) - min(ps.values()) < 0.05:   # flat fit (no stakes sensitivity): use the canonical middle level, not an arbitrary tie
            sel = [sorted(levels)[len(levels) // 2]]
        else:
            sel = [min(levels, key=lambda L: abs(ps[L] - target))]
        flag = "ceiling" if t and t["side"] == "always above" else "floor"
    return {"levels": sel, "fitted_p": {L: round(p_at(b, L), 3) for L in levels}, "tipping": t, "flag": flag}

def observed_flag(x, y, sel, band=(0.25, 0.75)):
    """Pre-lock rule (v3-final): a manipulation level is 'calibrated' iff the OBSERVED P(act) at the selected level(s), pooled, lies in
    [25%, 75%]; otherwise flagged ceiling (>75%) / floor (<25%). Replaces the tipping-validity flag, which mislabelled e.g. Haiku DS
    (tipping point just below the ladder, but 4/6 = 67% at rung 1)."""
    ys = [b for a, b in zip(x, y) if a in set(sel)]
    if not ys: return None, None
    p = sum(ys) / len(ys)
    return ("ceiling" if p > band[1] else "floor" if p < band[0] else None), round(p, 3)

def apply_observed_flag(sel_out, x, y):
    sel_out["fit_flag"] = sel_out.get("flag")
    sel_out["flag"], sel_out["observed_p"] = observed_flag(x, y, sel_out["levels"])
    return sel_out

def cohen_kappa(a, b):
    pairs = [(x, y) for x, y in zip(a, b) if x is not None and y is not None]
    if not pairs: return float("nan"), 0
    labs = sorted({v for p in pairs for v in p}); n = len(pairs)
    po = sum(x == y for x, y in pairs) / n
    pe = sum((sum(x == l for x, _ in pairs) / n) * (sum(y == l for _, y in pairs) / n) for l in labs)
    return (1.0 if pe == 1 else (po - pe) / (1 - pe)), n

def gwet_ac1(a, b):
    """Gwet's AC1: chance-corrected agreement that stays stable when one label dominates (kappa paradox)."""
    pairs = [(x, y) for x, y in zip(a, b) if x is not None and y is not None]
    if not pairs: return float("nan")
    labs = sorted({v for p in pairs for v in p}); n = len(pairs); q = len(labs)
    if q < 2: return 1.0
    po = sum(x == y for x, y in pairs) / n
    pi = {l: (sum(x == l for x, _ in pairs) + sum(y == l for _, y in pairs)) / (2 * n) for l in labs}
    pe = sum(p * (1 - p) for p in pi.values()) / (q - 1)
    return (po - pe) / (1 - pe)

def tipping_bayes(x, y, lo, hi, prior_sd=2.5, ngrid=161):
    """Separation-robust tipping point (v3c). Model logit P = b (x - t). Prior: t uniform on [lo-1, hi+1]; b ~ N(0, prior_sd^2) per ladder step
    (weakly informative, Gelman et al. 2008 style). Grid posterior; returns posterior median and 95% equal-tailed credible interval of t.
    Under perfect separation the interval stays finite and honest (spans the gap between the last 0-level and first 1-level) instead of collapsing."""
    x = np.asarray(x, float); y = np.asarray(y, float)
    if len(x) == 0: return None
    T = np.linspace(lo - 1, hi + 1, ngrid); Bs = np.linspace(-10, 10, 201)
    Tg, Bg = np.meshgrid(T, Bs, indexing="ij")
    z = Bg[..., None] * (x[None, None, :] - Tg[..., None])
    ll = (y * z - np.logaddexp(0, z)).sum(-1) - 0.5 * (Bg / prior_sd) ** 2
    w = np.exp(ll - ll.max()); w /= w.sum(); pt = w.sum(1); cdf = np.cumsum(pt)
    q = lambda a: float(np.interp(a, cdf, T))
    inr = float(pt[(T >= lo - 0.5) & (T <= hi + 0.5)].sum())
    b = fit(x, y); est = q(0.5)
    valid = inr >= 0.5 and lo - 0.5 <= est <= hi + 0.5
    side = None if valid else ("always above" if p_at(b, lo) > 0.5 else "always below")
    return dict(est=est, lo=q(0.025), hi=q(0.975), valid=bool(valid), side=side, b=[float(b[0]), float(b[1])], in_range=inr, method="bayes-grid")
