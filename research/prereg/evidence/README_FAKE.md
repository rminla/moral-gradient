# Fake Transport Canary Evidence

**⚠️ This is FAKE TRANSPORT evidence - zero real API calls were made.**

All canaries ran with `FAKE_TRANSPORT=1` using mocked API responses.

## Files

- `s1_canary_evidence.json`, `s2_canary_evidence.json`: Unit counts by model/arm/cell
- `s1_canary_check_*_FAKE.txt`: canary_check output per model (S1)
- `s2_canary_check_*_FAKE.txt`: canary_check output per model (S2)
- `s1_canary_combined_FAKE.jsonl`: All S1 canary units (256 total)
- `s2_canary_combined_FAKE.jsonl`: All S2 canary units (256 total)
- `s1_canary_analysis_FAKE.txt`, `s1_canary_analysis_FAKE.json`: S1 analysis output
- `s2_canary_analysis_FAKE.txt`, `s2_canary_analysis_FAKE.json`: S2 analysis output

## Counts

- S1: 256 units (64 per model, 16 per arm per model)
- S2: 256 units (64 per model, 16 per cell per model)
- 0 errors in all runs
