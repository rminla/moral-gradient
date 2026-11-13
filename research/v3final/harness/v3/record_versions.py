#!/usr/bin/env python3
"""Record model versions/snapshots for an iteration (model-agnostic; reads v3/registry.json).
Before a run: provider model metadata (where the provider exposes it). After a run: the model ids the
providers actually returned (ledger model_returned) and the date range of the calls. Never prints keys.
Usage: python3 v3/record_versions.py <iter>   -> data/v3/<iter>/model_versions.json (merged, re-runnable)"""
import json, os, sqlite3, sys, urllib.request
from datetime import datetime, timezone
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from v3.client import REG
ROOT = Path(__file__).resolve().parent.parent; it = sys.argv[1]
dst = ROOT / "data/v3" / it / "model_versions.json"; dst.parent.mkdir(parents=True, exist_ok=True)
doc = json.loads(dst.read_text()) if dst.exists() else {"iteration": it, "models": {}}
P = REG["providers"]

def get(url, hdr):
    try:
        with urllib.request.urlopen(urllib.request.Request(url, headers={**hdr, "User-Agent": "moral-compass-pilot/1.0"}), timeout=20) as r: return json.load(r)
    except Exception as e: return {"error": f"{type(e).__name__}: {str(e)[:120]}"}

def meta(m):
    p = P[m["provider"]]; k = os.environ.get(p["key_env"], "")
    if p["api"] == "anthropic":
        d = get(f"https://api.anthropic.com/v1/models/{m['model']}", {"x-api-key": k, "anthropic-version": "2023-06-01"})
        return {x: d.get(x) for x in ("id", "display_name", "created_at", "error") if d.get(x) is not None}
    if "openrouter" in p["url"]:
        d = get("https://openrouter.ai/api/v1/models", {"Authorization": "Bearer " + k})
        hit = next((x for x in d.get("data", []) if x.get("id") == m["model"]), None) if "data" in d else None
        return {x: hit.get(x) for x in ("id", "canonical_slug", "created", "context_length")} if hit else {"error": d.get("error", "not listed")}
    base = p["url"].rsplit("/chat/completions", 1)[0]
    d = get(f"{base}/models/{m['model']}", {"Authorization": "Bearer " + k})
    return {x: d.get(x) for x in ("id", "owned_by", "created", "error") if d.get(x) is not None}

now = datetime.now(timezone.utc).isoformat(timespec="seconds")
db = sqlite3.connect(f"file:{ROOT/'data/ledger.sqlite'}?mode=ro", uri=True)
for m in REG["models"]:
    e = doc["models"].setdefault(m["name"], {})
    e.update(provider=m["provider"], model_requested=m["model"], params=m.get("params"), grader_params=m.get("grader_params"), roles=m["roles"])
    e.setdefault("provider_metadata_pre", {"checked_utc": now, **meta(m)})
    rows = db.execute("select model_returned, count(*), min(ts_utc), max(ts_utc) from calls where run_id like ? and model_requested=? group by model_returned",
                      (f"{it}-%", m["model"])).fetchall()
    tr = db.execute("select model_returned, count(*), min(ts_utc), max(ts_utc) from calls where run_id like ? and model_requested=? group by model_returned",
                    (f"traces-{it}-%", m["model"])).fetchall()
    if rows or tr:
        e["returned"] = [{"model_returned": r[0], "calls": r[1], "first_utc": r[2], "last_utc": r[3]} for r in rows + tr]
doc["updated_utc"] = now
dst.write_text(json.dumps(doc, indent=1)); print("wrote", dst)
for n, e in doc["models"].items(): print(n, e["model_requested"], e.get("provider_metadata_pre"), [x["model_returned"] for x in e.get("returned", [])])
