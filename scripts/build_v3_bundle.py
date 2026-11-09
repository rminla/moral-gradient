#!/usr/bin/env python3
"""Adapter: pilot v3 bundles (schema moral-compass/v3-bundle@1) -> data/v3-preview.json for the site.

Usage:  python3 scripts/build_v3_bundle.py                 # merge pilot iterations as a PREVIEW (default)
        python3 scripts/build_v3_bundle.py --final v1.0     # one locked-run bundle -> data/v3-bundle.json, status "final"
Env:    V3_OUT (default ../pilot/v3/out)

The site never needs per-model code: model and scenario names come from lib/v3meta.ts with id fallbacks,
and every chart reads the schema fields directly. NaN (Python json) is converted to null.
"""
import json, math, os, sys, datetime, re

OUT = os.path.abspath(os.environ.get("V3_OUT", os.path.join(os.path.dirname(__file__), "..", "..", "pilot", "v3", "out")))
SITE_DATA = os.path.join(os.path.dirname(__file__), "..", "data")
KEEP = ["n_units", "n_errors", "cost_usd", "flags", "calibration", "say_do_gap", "self_interest", "pressure",
        "ladder_awareness", "grader_agreement", "toolfix", "reasoning_trace"]

def clean(o):
    if isinstance(o, float):
        return None if (math.isnan(o) or math.isinf(o)) else round(o, 4)
    if isinstance(o, dict):
        return {str(k): clean(v) for k, v in o.items()}
    if isinstance(o, list):
        return [clean(v) for v in o]
    return o

def load(it):
    with open(os.path.join(OUT, it, "bundle.json")) as f:
        b = json.load(f)
    assert b.get("schema") == "moral-compass/v3-bundle@1", f"{it}: unexpected schema {b.get('schema')}"
    return {"iteration": b["iteration"], "models": {m: {k: v.get(k) for k in KEEP} for m, v in b["models"].items()}, "cross_model": b.get("cross_model")}

def examples(it=None):
    """Curated verbatim trace examples (out[/<it>]/traces/top_examples.md) -> structured list. Quotes are already checked verbatim."""
    p = os.path.join(OUT, *([it] if it else []), "traces", "top_examples.md")
    if not os.path.exists(p):
        return []
    txt = open(p).read()
    items = re.split(r"\n(?=\d+\. \*\*)", txt)
    res = []
    for it in items:
        m = re.match(r"(\d+)\. \*\*(.+?)\*\*\s*(.*)", it, re.S)
        if not m:
            continue
        n, title, body = m.groups()
        rid = re.search(r"`(v3[a-z]+/[^/`]+/[^`]+)`", body)
        res.append({"n": int(n), "title": title.strip(), "run_id": rid.group(1) if rid else None,
                    "model": rid.group(1).split("/")[1] if rid else None, "body": body.strip()})
    return res

# Shown on every page that carries results, and in /api/v3. Update both when a new locked run replaces this one.
FINAL_LABEL = "Final results · v3 · locked run, Nov 2, 2026"
METHOD_VERSION = "v3-final: METHOD.md frozen with the pre-lock amendments of Oct 31, 2026; locked-run harness at pilot commit 895e032"

def main():
    a = sys.argv[1:]
    now = datetime.datetime.now(datetime.timezone.utc).isoformat(timespec="seconds")
    if "--final" in a:
        it = a[a.index("--final") + 1]
        doc = {"schema": "moral-gradient/site-v3@1", "status": "final", "generated_utc": now, "source": f"locked run {it}",
               "label": FINAL_LABEL, "method_version": METHOD_VERSION,
               "iterations": [load(it)], "examples": examples(it)}
        dst = os.path.join(SITE_DATA, "v3-bundle.json")
    else:
        its = sorted(d for d in os.listdir(OUT) if re.fullmatch(r"v3[a-z]", d) and os.path.exists(os.path.join(OUT, d, "bundle.json")))
        doc = {"schema": "moral-gradient/site-v3@1", "status": "preview", "label": "Preliminary results · v0.9 · updated Nov 1, 2026 · final run pending",
               "generated_utc": now,
               "source": f"methodology-development iterations {its[0]}–{its[-1]} (designs changed between iterations; small samples)",
               "iterations": [load(i) for i in its], "examples": examples()}
        dst = os.path.join(SITE_DATA, "v3-preview.json")
    with open(dst, "w") as f:
        json.dump(clean(doc), f, separators=(",", ":"), allow_nan=False)
    print("wrote", os.path.relpath(dst), f"{os.path.getsize(dst)/1024:.0f} KB", "iterations:", [x["iteration"] for x in doc["iterations"]])

if __name__ == "__main__":
    main()
