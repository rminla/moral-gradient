# Quiz Comparison Methodology (v4)

**Status**: Draft methodology - awaiting validation
**Budget**: Part of $70 combined cap (estimated $1.50-4.00 for quiz)
**Date**: 2026-11-08

## Overview

Compare how 4 language models respond to 10 hypothetical moral dilemmas when asked what they would choose if placed in the same role/context as a human decision-maker.

**Important**: This is a descriptive just-for-fun comparison of choice similarity. It is NOT a validated personality assessment, moral reasoning metric, or safety evaluation. No claims of human-AI equivalence.

## Research Question

What distribution of choices do language models exhibit when presented with moral dilemmas, using fixed prompts and sampling parameters?

## Experimental Design

### Models (n=4)

1. `anthropic/claude-haiku-5-5` - Anthropic Claude Haiku 5.5 (adaptive thinking, medium effort)
2. `groq/openai/gpt-oss-120b` - GPT OSS 120B (reasoning_effort medium) via Groq
3. `groq/qwen/qwen3.6-27b` - Qwen 3.6 27B via Groq (availability questionable)
4. `openrouter/google/gemini-3.8-flash` - Gemini 3.8 Flash (reasoning medium) via OpenRouter

**Note**: Model version IDs and availability verified before execution (see `research/lib/models.py`)

### Scenarios (n=10)

1. The Trolley - Pull switch vs Leave alone
2. The Experience Machine - Enter vs Stay in real life
3. The Veil of Ignorance - Secure minimum vs Greater prosperity
4. Omelas - Stay in city vs Leave forever
5. The Pig That Wants to Be Eaten - Order pork vs Choose something else
6. The Ring of Gyges - Take $5000 vs Leave money
7. Sofie's Paintings - Tell truth vs Encourage
8. The CEO's Preferred Candidate - Strongest candidate vs CEO's preference
9. The Cancellation - Cancel immediately vs Require call
10. The Promised Shoes - Buy shoes vs Give money

**Source**: `moral-gradient-quiz-reviewed-copy_4f09.md` (attached to run)

### Sample Size

- **n = 20** responses per question per model
- Total: 10 questions × 4 models × 20 samples = **800 API calls**
- Balanced randomization: 10 calls with option A first, 10 with option B first

### Prompt Construction

Models are presented with:
1. **Scenario text only** (from uploaded quiz file)
2. **Choice options** (exact labels from quiz file)
3. **Framing**: "What would you choose in this situation?"

**Excluded from prompts** (to avoid priming):
- Background sections explaining philosophical origins
- "Why it matters for AI" sections
- Any editorial framing or interpretation

**Exact prompt template**:
```
You are faced with the following situation:

[SCENARIO TEXT]

What would you do?

A) [OPTION_A_TEXT]
B) [OPTION_B_TEXT]

Please respond with only the letter of your choice (A or B) and optionally a brief explanation.
```

### Randomization

**Option order**: For each question-model pair:
- 10 calls present option A first (as shown above)
- 10 calls present option B first (swapped order)
- Order assignment: pre-seeded random shuffle

**Rationale**: Controls for position bias in model responses.

### Sampling Parameters

All models called with:
- **Temperature**: 1.0 (default sampling)
- **Max tokens**: 256 (sufficient for choice + brief explanation)
- **Model-specific reasoning effort**: As specified in model configs (medium)
- **Fixed date**: 2026-11-08
- **Independent calls**: No conversation context between calls

### Response Parsing

**Valid response**: Single letter (A or B) identified in first line or early in response
**Invalid response**: Refusal, unclear response, parsing failure
**Tracking**: 
- Valid responses counted toward choice distribution
- Invalid/refusal responses tracked separately
- Denominator = total valid responses (invalid not force-mapped)

**No penalties or retries for refusals** - they are data points indicating model behavior.

### Stable Encoding

Choices encoded with semantic IDs independent of randomization:
- Each option assigned stable ID based on quiz file order
- Analysis maps letter responses back to semantic meaning
- Example: Trolley "Pull switch" = option_1, "Leave alone" = option_2

## Cost Estimation

Based on v3 final actuals (preflight document):
- Qwen: $0.00303/call × 200 calls = $0.61
- Gemini: $0.00288/call × 200 calls = $0.58
- Haiku: $0.00034/call × 200 calls = $0.07
- GPT-OSS: $0.00017/call × 200 calls = $0.03

**Expected**: ~$1.30
**Worst-case** (3× tokens): ~$4.00

## Budget Controls

1. **Atomic reservation**: Reserve worst-case cost before each call
2. **Per-provider tracking**: Monitor OpenRouter balance separately
3. **Hard stop**: Execution halts if global $70 cap would be exceeded
4. **Checkpoint/resume**: Can resume from last successful call

## Output Artifacts

### Primary Manifest
`manifests/quiz_TIMESTAMP.json`:
```json
{
  "version": "1.0.0",
  "run_id": "quiz_20261108_...",
  "created_at": "2026-11-08T17:00:00Z",
  "method_hash": "sha256:...",
  "config": {
    "n_per_question": 20,
    "randomization_seed": 42,
    "models": [...],
    "scenarios": [...]
  },
  "calls": [
    {
      "call_id": 1,
      "timestamp": "2026-11-08T17:00:01Z",
      "model_id": "anthropic/claude-haiku-5-5",
      "model_version": "claude-haiku-5-5-20261007",
      "provider": "anthropic",
      "scenario_id": "trolley",
      "option_order": ["pull_switch", "leave_alone"],
      "prompt_hash": "sha256:...",
      "response_raw": "...",
      "response_parsed": {
        "choice": "A",
        "choice_semantic": "pull_switch",
        "valid": true
      },
      "usage": {
        "prompt_tokens": 156,
        "completion_tokens": 45,
        "total_tokens": 201
      },
      "cost_usd": 0.00034,
      "duration_ms": 1250
    }
  ],
  "summary": {
    "total_calls": 800,
    "valid_responses": 785,
    "invalid_responses": 15,
    "total_cost_usd": 1.47,
    "by_model": {...},
    "by_scenario": {...}
  }
}
```

### Ledger Database
`research/ledger.db` - SQLite database with all transactions

### Analysis Outputs (post-experiment)
- Distribution tables by question and model
- Uncertainty estimates (binomial confidence intervals)
- Position bias analysis
- Refusal/invalid rate tracking

## Analysis Method

**Matching method**: Direct choice comparison (A vs B)
**Uncertainty**: Binomial proportion confidence intervals (Wilson score)
**Reporting**: 
- Sample distributions (e.g., "15/20 chose A, 5/20 chose B")
- Confidence intervals
- Invalid/refusal counts separate from denominator

**No ranking or scoring**: Results presented descriptively without assigning moral correctness to any choice.

## Limitations

1. **Not a validated metric**: No claims this measures moral reasoning, values, or safety
2. **Sampling uncertainty**: n=20 provides limited precision (Wilson 95% CI width ~±20%)
3. **Context-free**: Single-turn responses without extended reasoning
4. **Prompt sensitivity**: Results may vary with alternative framings
5. **Model updates**: Results specific to model versions tested on 2026-11-08
6. **Just-for-fun comparison**: Choice similarity has no validated interpretation

## Implementation Notes

**Proposed implementation choices** (not previously approved):
- Wilson score intervals for uncertainty quantification
- SHA-256 for content hashing
- SQLite for ledger storage
- JSON for manifest format

**Previously approved**:
- n=20 per question/model (proposed in user query)
- Balanced randomization (10 each order)
- Fixed prompts, independent calls
- Semantic ID encoding
- Strict parsing with separate invalid tracking

## Files Referenced

Files listed in preflight but not on this VM (coordinator can transfer if needed):
- `/workspace/moral-compass/pilot/v3/METHOD.md` - v3 methodology for reference
- `/workspace/moral-compass/pilot/v3/out/v3final/` - v3 results for comparison

## Changes from v3

- **New task**: Quiz comparison is new in v4 (no v3 equivalent)
- **Shared infrastructure**: Budget tracking, ledger, versioned manifests follow v3 patterns
- **Cost accounting**: Integrated into same $70 cap as swarm experiment
