#!/bin/bash
# v3-final LOCKED end-to-end run (all 4 models, fresh calibration, full preset). Approved by the project owner (Nov 2, 2026).
# Includes: schema tool-call validation (v3-toolfix), per-turn trace storage, active-vs-wall clock + pause heartbeat,
# ledger lock timeout, DS rung 0, pressure n=24/arm, awareness reported only where the positive control fires (analyze.py),
# then blind trace grading (v3-traces) and model-version recording.
# Estimate from observed per-unit rates: ~$21 main (+~$2 trace grading). Per-model caps sum to $28; the pilot hard cap ($85, ledger
# total) binds first. Keep an agent session polling while this runs: the box VM is frozen when no session is active.
set -u
cd .
IT=v3final
ARGS="--iter $IT --stage all --preset full --workers 8 --cues memo_soft,memo_soft_eval,none --cue-n memo_soft:24,memo_soft_eval:8,none:24 --dilemmas fb,ds --pilot-cap 85"
MODELS="claude-haiku-5.5 gpt-oss-120b qwen3.6-27b gemini-3.8-flash"
echo "$(date '+%F %H:%M %Z') locked run start"
python3 v3/test_prelock.py || { echo "pre-lock tests failed"; exit 1; }
python3 v3/record_versions.py $IT
for mb in claude-haiku-5.5:2 gpt-oss-120b:1.5 qwen3.6-27b:11.5 gemini-3.8-flash:13; do
  m=${mb%%:*}; b=${mb##*:}
  python3 v3/run.py $m $ARGS --budget $b > logs/v3/$IT-$m.log 2>&1 &
done
wait
errs() { python3 -c "
import json,sys
d={}
for f in ('calibrate','main'):
  try: [d.__setitem__((f,r['key']), r) for r in map(json.loads, open(f'data/v3/$IT/$1/{f}.jsonl'))]
  except FileNotFoundError: pass
print(sum(1 for r in d.values() if r.get('error')))"; }
for pass in 1 2; do   # resume errored units (run.py skips done keys); budget stops are not retried
  for mb in claude-haiku-5.5:2 gpt-oss-120b:1.5 qwen3.6-27b:11.5 gemini-3.8-flash:13; do
    m=${mb%%:*}; b=${mb##*:}; e=$(errs $m)
    if [ "$e" != "0" ] && ! grep -q "BUDGET STOP" logs/v3/$IT-$m.log; then
      echo "$(date '+%H:%M %Z') retry pass $pass: $m has $e errored units"; python3 v3/run.py $m $ARGS --budget $b >> logs/v3/$IT-$m.log 2>&1
    fi
  done
done
echo "$(date '+%F %H:%M %Z') main runs finished"
python3 v3/traces.py grade $IT --budget 6 --pilot-cap 85 > logs/v3/$IT-traces.log 2>&1
python3 v3/record_versions.py $IT
python3 v3/analyze.py $IT $MODELS
TRACES_OUT=v3/out/$IT/traces python3 v3/traces.py analyze $IT
echo "$(date '+%F %H:%M %Z') LOCKED DONE"
