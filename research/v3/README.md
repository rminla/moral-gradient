# V3 Harness: Preregistered Studies S1 and S2

This directory contains the v3 research harness for two preregistered follow-up studies in the Moral Gradient research program.

## Studies

### Study 1: Beneficiary Control
- **Design**: 4 arms (ORG, SELF, OTHER, NONE) × 4 models × 24 per arm = 384 units
- **Arms**: 
  - `benef_org`: Fee recovery on billing team's scorecard
  - `benef_self`: Fee recovery on assistant's own scorecard
  - `benef_other`: Fee recovery on Ridgeway Collections' scorecard (external agency)
  - `none`: No cue (neutral baseline)
- **Optional BRIDGE arm**: `benef_bridge` (memo_soft equivalent)
- **Budget**: Canary $2.97, Main $8.92, total cap $11.89

### Study 2: Role × Tools
- **Design**: 2x2 (agent/advisor × tools/notools) × 4 models × 24 per cell = 384 units
- **Cells**:
  - `agent_tools`: Agent role with tool access
  - `agent_notools`: Agent role without tools (parse DECISION)
  - `advisor_tools`: Advisor role with tool access
  - `advisor_notools`: Advisor role without tools (parse DECISION)
- **Budget**: Canary $1.40, Main $4.21, total cap $5.61

**Combined hard cap**: $17.50 (includes both studies)

## Files

### Core Harness
- `cases.py`: Case generation (car_si_case, car_role_spec)
- `run.py`: Main execution harness with --dry-run mode
- `traces.py`: Trace grading (SI phase only)
- `constants.py`: Model configs, calibration levels, cue arms

### Analysis
- `analyze_s1.py`: Study 1 preregistered analysis (pooled logistic regression, Wald tests, Wilson CIs, Newcombe differences, Fisher exact, LR test, sensitivity)
- `analyze_s2.py`: Study 2 preregistered analysis (similar tests for 2x2 design)

### Quality Control
- `canary_check.py`: Canary gate checker (prompt match, coded outcomes, unparsed rates, cost)
- `test_prereg.py`: Tests that rendered specs match JSON files byte-for-byte

### Run Scripts
- `run_s1_canary.sh`: Study 1 canary (8 per cue)
- `run_s1_main.sh`: Study 1 main (24 per cue)
- `run_s2_canary.sh`: Study 2 canary (8 per level)
- `run_s2_main.sh`: Study 2 main (24 per level)

### Data
- `prompts_study1.json`: Preregistered Study 1 prompts (357KB, SHA256: 522422ac...)
- `prompts_study2.json`: Preregistered Study 2 prompts (190KB, SHA256: 2fa4403c...)

## Usage

### Install Dependencies
```bash
pip install -r requirements.txt
```

### Run Tests (Offline, No API Calls)
```bash
# All tests
python -m pytest test_prereg.py -v

# Study 1 tests only
python -m pytest test_prereg.py -v -k "test_study1"

# Study 2 tests only
python -m pytest test_prereg.py -v -k "test_study2"
```

### Dry-Run Mode (Cost Estimation)
```bash
# Study 1 main dry-run
python -m v3.run \
  --iter s1-benef \
  --stage main \
  --phases si \
  --cues benef_org,benef_self,benef_other,none \
  --cue-n benef_org:24,benef_self:24,benef_other:24,none:24 \
  --reuse-calibration v3final \
  --dry-run

# Study 2 main dry-run
python -m v3.run \
  --iter s2-role \
  --stage main \
  --phases role \
  --role-n 24 \
  --reuse-calibration v3final \
  --dry-run
```

### Execute Studies (Requires API Keys)
```bash
# Study 1: run canary first, review gate checks, then run main
./run_s1_canary.sh
# ... review canary_check output ...
./run_s1_main.sh

# Study 2: run canary first, review gate checks, then run main
./run_s2_canary.sh
# ... review canary_check output ...
./run_s2_main.sh
```

### Manual Execution
```bash
# Study 1 main
python -m v3.run \
  --iter s1-benef \
  --stage main \
  --phases si \
  --preset full \
  --cues benef_org,benef_self,benef_other,none \
  --cue-n benef_org:24,benef_self:24,benef_other:24,none:24 \
  --reuse-calibration v3final

# Study 2 main
python -m v3.run \
  --iter s2-role \
  --stage main \
  --phases role \
  --role-n 24 \
  --reuse-calibration v3final
```

### Run Analysis
```bash
# Study 1
python -m v3.analyze_s1 output/s1-benef/graded.jsonl

# Study 2
python -m v3.analyze_s2 output/s2-role/graded.jsonl
```

## Design Decisions

### Single-Arm Cues
Study 1 cues (benef_org, benef_self, benef_other) only run the `incentive` arm. The `none` cue runs only `neutral`. This avoids generating neutral baselines for every cue.

The `CUE_ARMS` dict in `constants.py` controls this:
```python
CUE_ARMS = {
    "benef_org": ("incentive",),
    "benef_self": ("incentive",),
    "benef_other": ("incentive",),
    "none": ("neutral",),
}
```

### Qwen Keep-Fee Definition
The Qwen keep-fee definition is **exactly 31 characters**: `"keeps the fee (outcome: \`keep\`)"`. This matches the single rule stated in HARNESS-CHANGES.md and is verified in both `analyze.py` and `traces.py`.

### Calibration Reuse
`--reuse-calibration v3final` validates that selected levels match preregistered ones:
- Haiku: [4, 5]
- gpt-oss: [1, 2]
- Qwen: [2, 3]
- Gemini: [2, 3]

### No Rationale Grading for Role Phase
Per spec, Study 2 (role phase) skips rationale grading and probes. Only SI phase gets those.

## Testing

All tests use `MockClient` and make **zero paid API calls**. Tests verify:
- Rendered specs match JSON files byte-for-byte
- Unit counts match preregistration (384 per study)
- Balance across levels and paraphrases
- Unique keys
- Single-arm cues produce no neutral units
- DECISION parser handles case-insensitive, bold markup, last-line-wins

Run `python -m pytest test_prereg.py -v` to verify.

## Output Structure

```
output/
├── s1-benef-canary/
│   ├── calls.jsonl          # Raw API calls and responses
│   ├── graded.jsonl         # Graded traces
│   └── versions.json        # Environment versions
├── s1-benef/
│   ├── calls.jsonl
│   ├── graded.jsonl
│   └── versions.json
├── s2-role-canary/
│   └── ...
└── s2-role/
    └── ...
```

## Budget Tracking

The harness includes:
1. **Dry-run mode** (`--dry-run`): Prints estimated calls and projected costs
2. **Pre-flight checks**: Validates that total spend + cap ≤ $70
3. **Per-call cost tracking**: Every API call logs input/output tokens and cost
4. **Hard caps**: Run stops when cap is reached

## Prompt SHA256 Hashes

Record these in the PR body:
- `prompts_study1.json`: `522422ac87b3908ba37d28271433ae91b3e72bcda67f202278afcb80d398d9c1`
- `prompts_study2.json`: `2fa4403cac3ce81cfd7a52f81353959fec2c8efb7284100fe8fba9fe55b58c9f`

## References

- HARNESS-CHANGES.md: Full specification for both studies
- Preregistration: [Link TBD]
- V3 final results: [Link TBD]
