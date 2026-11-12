# Production Bug Fixes - v4.1 (2026-11-08 20:43 UTC)

**Context**: Real box smoke test executed 40 successful API calls (20 gpt-oss, 20 Gemini) spending $0.0472, but exposed 5 critical production bugs. All fixed and validated with 38 passing offline tests.

---

## Bug #1: Test Contamination of Production Ledger

### Problem
Offline pytest runs wrote mock data to production `research/ledger.db`:
- 30 mock Haiku rows (`claude-haiku-5-5-mock`, fake $0.0008 cost)
- Caused duplicate call_id errors during real Haiku execution
- Contaminated billable totals with fake test data

### Root Cause
Tests instantiated `BudgetTracker` with default `research/ledger.db` path instead of temp directories.

### Fix
1. **Test Isolation**: All tests now use `tempfile.TemporaryDirectory()` and pass explicit `ledger_path` parameter
2. **Run Function Signatures**: Added `ledger_path: Optional[Path]` to `run_quiz()` and `run_swarm()`
3. **Archive Exclusion**: `.gitignore` and tar exclude `ledger.db`, `out/`, `*.pyc`, `__pycache__/`
4. **Migration Tool**: Created `tools/migrate_ledger.py` to mark mock data with `mock_data=1` column

**Files:**
- `research/tests/test_quiz.py` - Pass `ledger_path=Path(tmpdir) / "test_ledger.db"`
- `research/tests/test_swarm.py` - Same isolation
- `research/lib/budget.py` - Added `mock_data INTEGER DEFAULT 0` column to `calls` table
- `research/tools/migrate_ledger.py` - Migration utility with audit/backup/dry-run modes

**Verification:**
- Extracted archive: 0 `ledger.db` or `out/` files found
- All 38 tests pass with isolated temp ledgers

---

## Bug #2: Call ID Collisions Across Runs

### Problem
Call IDs like `scenario_model_0` collided between smoke and main runs:
- Smoke validation calls overwritten by main samples
- No distinction between experiments
- Idempotent resume impossible across runs

### Root Cause
Call IDs lacked unique run identifier namespace.

### Fix
1. **Run ID Namespacing**: Added `run_id` parameter to `run_quiz()` and `run_swarm()`, defaults to `{protocol}_{YYYYMMDD_HHMMSS}`
2. **Namespaced Call IDs**:
   - Quiz: `{run_id}_{scenario_id}_{model_slug}_{call_idx}`
   - Swarm: `{run_id}_{episode_id}_turn_{N}[_role]`
3. **Idempotent Resume**: Same `run_id` → skip existing calls; new `run_id` → distinct namespace

**Files:**
- `research/quiz/run_quiz.py` - Added `run_id` parameter, prefix all call_ids
- `research/swarm/run_swarm.py` - Added `run_id` parameter to functions and episode runners
- `research/tests/test_swarm.py` - Fixed test calls to pass unique `run_id`

**Example:**
- Smoke: `quiz_20261108_smoke_trolley_anthropic_claude-haiku-5-5_0`
- Main: `quiz_20261108_main_trolley_anthropic_claude-haiku-5-5_0`

**Verification:**
- Tests with distinct `run_id` parameters pass without collision
- Same `run_id` resume skips existing, different `run_id` creates new entries

---

## Bug #3: Qwen 400 Error - Invalid API Parameters

### Problem
Groq Qwen rejected 20 calls with HTTP 400:
```
'reasoning_effort must be one of none or default'
```
- Qwen does NOT support `reasoning_effort` parameter
- 20 failed calls left $0.1914 in unreleased reservations
- No circuit breaker: harness attempted all 20 retries despite permanent 400

### Root Cause
Groq Qwen uses `reasoning_format: "parsed"` (exact v3 tested config), NOT `reasoning_effort`.

### Fix
1. **Model-Specific Payload**: In `lib/providers.py _call_groq()`:
   - `if model_id == "groq/qwen/qwen3.6-27b"`: use `reasoning_format="parsed"`, skip `reasoning_effort`
   - Other Groq models (gpt-oss): use `reasoning_effort="medium"`
2. **Circuit Breaker**: Catch HTTP 400/401/403/404/credit errors, raise `RuntimeError` to halt retries
3. **Reservation Cleanup**: Wrap `_real_call()` in try-except, release reservation on failure with `error` field

**Files:**
- `research/lib/providers.py`:
  - `_call_groq()` - Model-specific parameter logic
  - `_call_anthropic()`, `_call_openrouter()` - Added circuit breaker
  - `call_model()` - Release reservations on call failures
  - `reconcile()` - Added `error: Optional[str]` parameter
- `research/lib/budget.py`:
  - `calls` table schema: added `error TEXT` column
  - `reconcile()` - Store error messages for failed calls

**Verification:**
- Strict mock tests verify exact Qwen payload: `reasoning_format` present, `reasoning_effort` absent
- Circuit breaker prevents 20-call retry loops on permanent errors

---

## Bug #4: Parser False Positives on Refusals

### Problem
gpt-oss trolley refusal falsely parsed as "A":
```
Response: "I'm not able to give a single-letter answer to this question."
Parsed: "A"  # INCORRECT - should be None
```
- 19 genuine gpt-oss choices + 1 false-positive = 20 reported (inflated valid count)
- Gemini markdown bold (`**A)**`, `**A**`) failed to parse (18/20 success, 2 missed)

### Root Cause
Parser matched first occurrence of letter "A" anywhere in text, including inside refusal phrases.

### Fix
1. **Refusal Detection First**: Regex patterns for common refusals:
   - `"I(?:'m| am) not (?:able|comfortable|willing)"`
   - `"cannot (?:provide|give|make|offer)"`
   - `"(?:refuse|decline) to"`
   - Return `None` immediately if refusal detected
2. **Strict Anchored Patterns**:
   - Markdown bold: `r'\*\*([AB])\*\*|\*\*([AB])\)'`
   - Line-start choice: `r'^([AB])\)'` with `re.MULTILINE`
   - Word boundaries: `r'\b(?:choose|option)\s+([AB])\b'`
3. **Case Insensitivity**: Handle lowercase `a`/`b` inputs
4. **Adversarial Tests**: Added `tests/test_parser.py` with exact refusal text

**Files:**
- `research/quiz/run_quiz.py` - Rewritten `parse_response()` with strict refusal-first logic
- `research/tests/test_parser.py` - 8 test cases covering refusals, markdown, edge cases

**Test Coverage:**
```python
# Must NOT match (refusals)
"I'm not able to give a single-letter answer"  → None ✓
"I cannot provide a simple A or B answer"      → None ✓

# Must match (valid)
"**A)**"                                       → "A" ✓
"After thinking: B"                            → "B" ✓
```

**Verification:**
- All 8 adversarial parser tests pass
- Real gpt-oss refusal text returns `None`

---

## Bug #5: Token Truncation & Missing finish_reason

### Problem
- Gemini responses hit 984/1024 tokens (near truncation)
- gpt-oss responses used 800+ tokens
- `max_tokens=256` (quiz) and `512` (swarm) insufficient for medium reasoning effort
- No tracking of `finish_reason` or truncation detection

### Root Cause
Token budgets too small for adaptive/parsed reasoning outputs.

### Fix
1. **Increased Budgets**:
   - Default `max_tokens=2048` (was 256) in `lib/providers.py`
   - Adequate for medium reasoning with safety margin
2. **Finish Reason Tracking**:
   - Added `finish_reason: Optional[str]` to `ModelResponse` dataclass
   - Extract from provider responses (Anthropic: `stop_reason`, OpenAI/Groq: `finish_reason`)
   - Record in quiz/swarm manifests with `truncated` flag
3. **Worst-Case Reservation**: Budget reservations include 2048 output tokens × 3x safety margin

**Files:**
- `research/lib/providers.py`:
  - `ModelResponse` - Added `finish_reason` field
  - All `_call_*()` methods - Extract and populate `finish_reason`
  - Default `max_tokens=2048`
- `research/quiz/run_quiz.py`:
  - Track `finish_reason` and `truncated = (finish_reason == "length")` in call records

**Verification:**
- Worst-case cost estimate tests pass with 2048 output tokens
- Mock responses include `finish_reason="stop"`

---

## Additional Improvements

### Error Handling & Reservation Cleanup

**Before**: Failed calls left unreleased reservations, inflating available budget calculations.

**After**:
- Wrap `_real_call()` in try-except
- On any exception, reconcile with `error` field and zero cost
- Permanent errors (4xx) trigger circuit breaker before reconciliation

### All Tests Isolated & Passing

**Results:**
```
================================ 38 passed, 241 warnings in 0.18s =================================
```

**Test Coverage:**
- Budget tracking (8 tests)
- Provider mocks (6 tests)
- Quiz harness (5 tests)
- Swarm harness (6 tests)
- Parser robustness (8 tests)
- Integration (2 tests)
- Pricing/deadlock (3 tests)

**Environment:**
- All API keys unset (`env -i`)
- Temp directories only
- No production state writes
- Fresh extraction verified

---

## Portable Archives

### Full Harness
**File**: `/opt/cursor/artifacts/moral-gradient-v4-harness.tar.gz`  
**SHA256**: `1ba53dc675461e99d054e8a930de4bc6195b0c59d18758a5092cfff007b36436`  
**Size**: 61 KB  
**Contents**: Complete research/ directory (quiz, swarm, lib, tests, tools, docs)

### Quiz-Ready Package
**File**: `/cursor/stores/self/quiz-ready.tar.gz`  
**SHA256**: `541e500ac5083d3de9eb4986d48df58b42380f09aec704675ea4de53c693b2d1`  
**Size**: 33 KB  
**Contents**: Quiz harness only (lib, quiz, tests, tools, manifests, docs)

**Exclusions** (both archives):
- `ledger.db` (production state)
- `out/` directories
- `__pycache__/` and `*.pyc`
- `.pytest_cache/`

---

## Files Modified

### Core Fixes (8 files)
1. `research/lib/budget.py` - Added `mock_data` and `error` columns, `reconcile()` error handling
2. `research/lib/providers.py` - Qwen payload fix, circuit breaker, finish_reason tracking, max_tokens=2048
3. `research/quiz/run_quiz.py` - Parser rewrite, run_id namespacing, finish_reason/truncation tracking, ledger_path param
4. `research/swarm/run_swarm.py` - Run_id namespacing, ledger_path param
5. `research/tests/test_quiz.py` - Isolated temp ledgers
6. `research/tests/test_swarm.py` - Isolated temp ledgers, run_id params
7. `research/tests/test_parser.py` - NEW: 8 adversarial parser tests
8. `research/tools/migrate_ledger.py` - NEW: Ledger migration utility

### Documentation (4 files)
9. `research/MIGRATION.md` - NEW: Migration guide
10. `research/RUN_INSTRUCTIONS.md` - Added run_id and migration sections
11. `research/PRODUCTION_FIXES.md` - NEW: This file
12. `research/BUDGET.md` - (No changes, already correct)

---

## Validation Summary

✅ **All 38 offline tests pass** (0 failures)  
✅ **Extracted archive tests pass** (fresh temp dir, no keys)  
✅ **No production state files** in archives (0 ledger.db, 0 out/)  
✅ **Qwen payload verified** with strict mocks (reasoning_format only)  
✅ **Parser adversarial tests** cover real gpt-oss refusal  
✅ **Call ID collision fixed** with run_id namespacing  
✅ **Reservation cleanup** on all error paths  
✅ **Migration tool tested** on simulated contaminated ledger  

---

## Next Steps for Coordinator

1. **Extract** fresh archive on box: `tar -xzf moral-gradient-v4-harness.tar.gz`
2. **Migrate** contaminated ledger (if exists): `python3 research/tools/migrate_ledger.py research/ledger.db --backup`
3. **Set API keys** for Anthropic, Groq, OpenRouter
4. **Run quiz**: `cd research && python3 quiz/run_quiz.py --budget-cap 5.00`
5. **Verify** quiz completes with 800 calls (~$1.30-4.00 spend)
6. **Run swarm**: `python3 swarm/run_swarm.py --budget-cap 65.00` (or adjust cap based on quiz actual)
7. **Check totals**: `sqlite3 ledger.db "SELECT SUM(actual_cost_usd) FROM calls WHERE mock_data = 0"`

Expected cumulative: ~$66-69 (quiz ~$1.30-4.00 + swarm ~$65)

---

**Status**: ✅ Production-ready with all bugs fixed, tested, and documented.
