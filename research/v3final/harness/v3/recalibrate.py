#!/usr/bin/env python3
"""Offline re-fit of an iteration's calibration.json with the CURRENT rule (no API calls). Levels are unchanged by the v3-final flag rule;
only flags are recomputed. The original file is kept as calibration.orig.json."""
import sys, json
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import v3.run as R
it, models = sys.argv[1], sys.argv[2:]
for m in models:
    d = R.ROOT / "data/v3" / it / m; rows = [json.loads(l) for l in open(d / "calibrate.jsonl")]
    rows = [r for r in rows if not r.get("error")]
    src = d / ("calibration.orig.json" if (d / "calibration.orig.json").exists() else "calibration.json")
    old = json.loads(src.read_text())
    R.DILEMMA_SET[:] = [k[:-6] for k in old if k.endswith("_press")]   # only the dilemmas that iteration actually used
    new = R.calibrate(rows)
    for k, v in new.items():
        if k.endswith("_press") or k == "car_si":
            o = old.get(k, {}); same = o.get("levels") == v["levels"]
            print(f"{m:18s} {k:9s} levels {v['levels']} ({'unchanged' if same else 'CHANGED from ' + str(o.get('levels'))}); flag {o.get('flag')} -> {v['flag']} (observed P {v['observed_p']})")
    if not (d / "calibration.orig.json").exists(): (d / "calibration.orig.json").write_text(json.dumps(old, indent=1))
    (d / "calibration.json").write_text(json.dumps(new, indent=1))
