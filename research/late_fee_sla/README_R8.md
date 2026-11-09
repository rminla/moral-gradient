# R8: Late Fee SLA Drift Experiment

Approved by Raphael. Measures verification rate drift when agents face time pressure and can share strategies via team notes.

## Design

- **Agents**: 4 Haiku customer service agents
- **Turns**: ~30 per agent (configurable)
- **Cases**: 42 late fee waiver requests per agent queue (never runs out)
  - 25% "decisive" cases (verification reveals critical info)
  - 75% confirmation cases (verification confirms story)
- **Tools**: `verify_hardship_and_account` (45-60s usually, 2-4s sometimes), decision tools, notes tools
- **Conditions**: 2×2 design
  - Notes: SHARED (one team_notes file) vs PRIVATE (per-agent notes)
  - Target: ON (5s target + leaderboard shown) vs OFF (no target shown)
- **Simulated timing**: Every tool reports elapsed seconds (no real waiting)
- **Budget**: Hard pre-call cap with strict UTF-8 byte upper bound, $5 default for full 2×2

## Correct Pricing

**Haiku 5.5 (claude-haiku-5-5)**:
- Input: **$0.10 per 1M tokens**
- Output: **$0.50 per 1M tokens**

*(R7 used 8× inflated prices; R8 corrects this)*

## Commands

### Run Unit Tests (Zero Cost)

```bash
cd research/late_fee_sla
python3 test_sla.py
```

Expected output:
```
TEST 1: Correct Haiku Pricing ✓
TEST 2: Simulated Verification Timing ✓
TEST 3: Strict Upper Bound Budget ✓
TEST 4: Case Queue Length ✓
ALL UNIT TESTS PASSED ✓
```

### Run Mock Dry Run (Zero Cost, All 4 Conditions)

```bash
cd research/late_fee_sla
python3 run_late_fee_sla.py --agents 4 --turns 5 --mock --output-dir dry_run_output
```

This runs all 4 conditions (2×2 design) with 5 turns per agent in mock mode. Output saved to `dry_run_output/`.

### Run Real Experiment (Paid API Calls)

**⚠️ DO NOT RUN WITHOUT APPROVAL** - Makes real API calls

```bash
cd research/late_fee_sla
export ANTHROPIC_API_KEY="your-key-here"
python3 run_late_fee_sla.py --agents 4 --turns 30 --cap 5.0 --output-dir real_run_output
```

This will:
- Run all 4 conditions sequentially
- Each: 4 agents × 30 turns = 120 turns
- Total: 480 API calls
- Refuse calls if budget would exceed $5.00

## Projected Real Cost

**Conservative estimate for full 2×2 run:**

Assumptions:
- 4 agents × 30 turns × 4 conditions = 480 API calls
- Average request: ~2000 bytes (system + messages + tools + history)
- Average output: 500 tokens per call (tool uses + reasoning)

Cost per call:
- Input: (2000 bytes / 1M) × $0.10 = $0.0002
- Output: (500 tokens / 1M) × $0.50 = $0.00025
- **Total per call: ~$0.00045**

**Total projected: 480 calls × $0.00045 = ~$0.22**

With conversation history growth:
- Later turns have longer context
- Conservative estimate with 5× average: **~$1.10**

**Budget cap: $5.00** (sufficient buffer)

## Output Files

After running, `output_dir/` contains:

1. **`summary.json`** - High-level metrics per condition
2. **`transcript_<condition>.json`** - Full turn-by-turn logs per condition
3. **`notes_log_<condition>.json`** - All notes reads/writes with before/after content
4. **`budget_ledger.jsonl`** - Persistent budget tracking

## Key Metrics Logged

- **Verification rate**: % of cases verified before deciding
- **Accuracy**: % of correct decisions (vs ground truth)
- **Handle time**: Per ticket and rolling average
- **Notes activity**: What gets posted, who reads it
- **Decisive cases**: Performance on cases where verification matters most

## Primary Research Questions

1. Does time pressure reduce verification rate?
2. Does shared notes amplify shortcuts (e.g. "skip the check")?
3. Do agents who read time-saving tips adopt them?
4. What's the accuracy cost of skipping verification on decisive cases?

## Implementation Notes

- **Correct pricing** ($0.10/$0.50 per 1M, not R7's $0.80/$4.00)
- **Strict budget cap** (UTF-8 byte upper bound, refuse before call)
- **Round-robin turns** (enables one agent to write, another to read later)
- **Persistent budget** (survives restarts via ledger)
- **Complete logs** (every tool call, timing, notes writes with attribution)
- **Simple summary** (descriptive stats only, no complex grading)

## Testing

Run `test_sla.py` to verify:
- Correct Haiku pricing constants
- Simulated timing ranges (45-60s, 2-4s, ~1s)
- Strict upper bound cost calculation
- Case queue length (42 > 30 turns)

Run mock dry run to verify:
- All 4 conditions execute
- Logs are complete
- Budget math correct
- No actual API calls ($0.00 spent)

---

**Delivered**: Code, tests, dry run, README
**Real run**: Execute separately on your box with API key
**Cost**: ~$0.22-$1.10 projected, $5.00 cap enforced
