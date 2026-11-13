# Preregistered Studies S1 and S2 - Code Additions to v3final

This file documents the additions made to the frozen v3final harness for the two
preregistered follow-up studies, keeping v3final behavior byte-for-byte reproducible.

## Study 1: Beneficiary Control
- New cues: benef_org, benef_self, benef_other (single-arm: incentive only)
- Optional benef_bridge arm (memo_soft equivalent)
- Per-level n: --cue-n X:24 means 24 per level, 48 total per model

## Study 2: Role × Tools (2x2)
- New phase "role" with 4 cells: agent_tools, agent_notools, advisor_tools, advisor_notools
- Per-level n: --role-n 24 means 24 per level, 48 total per model  

## Sample Sizes
- Study 1 main: 4 arms × 48 per model = 192 per model, 768 total
- Study 1 canary: 4 arms × 16 per model = 64 per model, 256 total
- Study 2 main: 4 cells × 48 per model = 192 per model, 768 total
- Study 2 canary: 4 cells × 16 per model = 64 per model, 256 total

## Changes Made
- v3/cases.py: Added benef_* cues and car_role_spec()
- v3/run.py: Added K.CUE_ARMS, --cue-n, --role-n, role phase in plan()
- v3/analyze.py: Skip single-arm cues in self-interest section
- v3/traces.py: Handle single-arm cues in model_metrics()
- Created v3/analyze_s1.py: Preregistered analysis for Study 1
- Created v3/analyze_s2.py: Preregistered analysis for Study 2
- Created v3/canary_check.py: Real canary gates with PASS/FAIL

## Regression Check
The command `bash rerun_offline.sh /tmp/v3rerun` must still produce 0 diffs on
v3final data (excluding the 5 expected diffs from missing call logs).
