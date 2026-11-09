# Swarm v_NEW R4 Standalone Archive

**Version**: R4 (2026-11-09)  
**Purpose**: Independent verification of swarm method implementation  
**Status**: All tests passing (10/10)  

---

## Quick Start

### 1. Extract Archive

```bash
cd /path/to/empty/directory
tar -xzf swarm_v_new_r4_YYYYMMDD_HHMMSS.tar.gz
```

### 2. Install Dependencies

```bash
pip install anthropic==2.6.0 openai==3.46.0 httpx
```

**Note**: These are the SDK versions used in prior quiz/swarm work. Offline tests use mock transports (no API keys required).

### 3. Run Tests

```bash
# SDK integration tests (5 tests)
python3 test_sdk_integration.py

# Comprehensive method tests (5 tests)
python3 test_comprehensive_integration.py

# Expected: All 10 tests PASS
```

### 4. Inspect Method

```bash
# Review complete method documentation
cat METHOD_v_NEW_R4.md

# Inspect cases and prompts
cat cases_v_new.json
cat prompts_v_new.json
cat config_v_new.json

# Check stage budget enforcement
cat stage_budget.py

# Check case environment and outcomes
cat case_environment.py
cat outcome_categories.py
```

### 5. Run Offline Mock Test (Optional)

```bash
# 64-episode mock test (192 calls, $0 spent)
# Requires ledger.db from parent run (not included in archive)

# If you have access to ledger:
python3 run_swarm_v_new.py \
  --pilot \
  --ledger-path /path/to/ledger.db \
  --output-dir ./output/mock_test \
  --baseline-locked 2.2036 \
  --stage-cap 5.0 \
  --dry-run

# Check results
ls -lh output/mock_test/journals/
ls -lh output/mock_test/episodes/
```

---

## What's Included

### Source Files (Implementation)

- `run_swarm_v_new.py` - Main harness with --pilot hard cap
- `stage_budget.py` - StageBudgetEnforcer with R4 reconcile fix
- `case_environment.py` - Deterministic tool execution
- `outcome_categories.py` - Semantic outcome classification
- `mock_transport.py` - SDK-level mock fixtures
- `cases_v_new.json` - 4 case definitions
- `prompts_v_new.json` - 6 role prompts
- `config_v_new.json` - Run configuration

### Test Suites (Verification)

- `test_sdk_integration.py` - 5 SDK integration tests
- `test_comprehensive_integration.py` - 5 method validation tests

### Documentation

- `METHOD_v_NEW_R4.md` - Complete method documentation
- `README_STANDALONE.md` - This file (extraction and execution)
- `HASHES.txt` - SHA256 hashes for method lock

### Dependencies (Not Included - Install Separately)

- `../lib/budget.py` - BudgetTracker (from parent harness)
- `../lib/providers.py` - ProviderClient (from parent harness)
- `../lib/models.py` - Model configs (from parent harness)
- `../lib/journal.py` - Journal writes (from parent harness)

**Note**: Archive is standalone for method review. Full execution requires parent `research/lib/` directory (available in repository).

---

## Test Results (R4)

### SDK Integration Tests (5/5 PASS)

```
1. ✅ StageBudgetEnforcer full reconcile() compatibility
2. ✅ Real Anthropic SDK with synthetic response
3. ✅ Real OpenAI SDK with synthetic response
4. ✅ ProviderClient with StageBudgetEnforcer
5. ✅ Stage oversubscription prevention
```

### Comprehensive Method Tests (5/5 PASS)

```
1. ✅ Baseline from ledger
2. ✅ Context parity (single vs team)
3. ✅ Tool extraction and effects
4. ✅ Semantic outcome classification
5. ✅ 64-episode hard cap
```

---

## R4 Fixes Summary

### Critical Fixes (R3 → R4)

1. **FATAL**: `StageBudgetEnforcer.reconcile()` signature incompatible with `ProviderClient` settlement. R3 would crash every paid call with TypeError after HTTP. R4 accepts full kwargs (model_version, prompt_tokens, completion_tokens, etc.).

2. **Provider Enum**: Tests fixed to use `Provider.ANTHROPIC` instead of string.

3. **Anthropic Response**: Removed invalid "thinking" block type from test fixtures (not in public SDK).

4. **OpenAI Import**: Fixed `openai.types.chat.ChatCompletion` import path.

5. **Method Tests**: Added 5 comprehensive integration tests for baseline, context parity, tools, outcomes, cap.

---

## Honest Limitations

### What R4 Tests PROVE ✅

- Budget enforcement (atomic, baseline, reconcile, oversubscription)
- SDK path (real Message/ChatCompletion objects)
- Context parity (template placeholders verified)
- Tool execution (deterministic effects)
- Semantic outcomes (9 categories)
- Hard cap (64 episodes × 3 calls = 192)

### What R4 Does NOT Prove ❌

- **HTTP serialization**: Offline tests use mocks, not actual network transport
- **Full integration run**: No 64-episode execution (per constraint: no VM paid calls)
- **Rendered SDK payloads**: Static template inspection, not actual sent messages
- **Real tool extractions**: Synthetic responses, not actual model outputs

### What Live Canary Will Cover

- Actual HTTP with network serialization
- Actual SDK responses (tool_use blocks, thinking, malformed)
- Actual effects on real episodes
- Actual costs with real token counts
- Actual rendered prompts for context parity inspection

**User approved**: "Small live canary on BOX ONLY may follow independent pass at most 1 episode/model = 4 total = 12 calls within 64 overall/$5 ceiling, halt immediately technical/method fault; NOT blanket 64 automatic before canary."

---

## Method Overview

### Design Pillars

1. **3-Turn Parity**: Single (plan → review → act) vs Team (worker → manager → reviewer)
2. **Final Actor Only Tools**: Action tools on turn 3 only
3. **Role Parity**: All agents receive complete case facts
4. **Matched Pressure**: Turn 2 gets identical case-specific incentive pressure
5. **Context Parity**: Both final actors see identical facts + pressure history + tools
6. **Deterministic Tool Effects**: Fictional environment with recorded state changes
7. **Explicit Semantic Outcomes**: 9 categories (not lumped)

### 4 Cases

1. **late_fee**: Customer requesting fee waiver (organizational + KPI pressure)
2. **ceo_candidate**: Board choosing CEO (personal + authority pressure)
3. **powerbank**: Defective product return (personal + financial pressure)
4. **bonus_split**: Discovered coworker did half the work (personal + financial pressure)

### Hard Constraints

- **64 episodes × 3 calls = 192 model calls MAX**
- **$5 stage cap above $2.2036 baseline**
- **$70 global cap absolute**
- **NO auto-resume into full 1920 run**

---

## Verification Checklist

### Before Accepting Implementation

- [ ] All 10 tests pass
- [ ] `METHOD_v_NEW_R4.md` reviewed and understood
- [ ] Cases inspected: 4 cases, clean baseline, case-specific pressure
- [ ] Prompts inspected: 6 roles, context parity placeholders present
- [ ] Stage budget: Reconcile signature correct, baseline from ledger, atomic enforcement
- [ ] Case environment: Deterministic tool execution, effects recorded
- [ ] Outcomes: 9 semantic categories mapped, not lumped
- [ ] Hard cap: 64 episodes enforced, no auto-resume logic
- [ ] Security: No private fixtures in archive, no credentials exposed

### Before Running Live Canary

- [ ] Offline 64-episode mock test completed successfully
- [ ] Journals inspected: Full prompts, responses, tool calls, costs
- [ ] Episodes inspected: Semantic outcomes, effects, state changes
- [ ] Ledger verified: 192 settled calls, costs reconciled
- [ ] Method hash locked (cases, prompts, config, harness)
- [ ] User authorization for small live canary (4 episodes = 12 calls)

---

## Questions or Issues?

### Test Failures

If tests fail:
1. Check Python version (3.10+)
2. Verify SDK versions (`pip list | grep -E 'anthropic|openai'`)
3. Check dependencies (`pip install -r requirements.txt`)
4. Report exact test output and traceback

### Method Questions

For design questions:
- Read `METHOD_v_NEW_R4.md` section by section
- Check "Honest Limitations" section for acknowledged gaps
- Inspect actual source files (cases, prompts, harness)

### Ready to Continue?

If all tests pass and method is acceptable:
- **Next**: Run offline 64-episode mock test
- **Then**: User decides on small live canary authorization
- **NOT automatic**: No blanket 64-episode run before user review

---

## File Hashes (Method Lock)

```
SHA256(cases_v_new.json) = [see HASHES.txt]
SHA256(prompts_v_new.json) = [see HASHES.txt]
SHA256(config_v_new.json) = [see HASHES.txt]
SHA256(run_swarm_v_new.py) = [see HASHES.txt]
SHA256(stage_budget.py) = [see HASHES.txt]
```

Lock point: R4 archive creation (2026-11-09)

---

## License & Attribution

Part of moral-gradient research repository.  
For research and review purposes.  
Not for production deployment without approval.
