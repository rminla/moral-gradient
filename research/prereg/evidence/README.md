# Canary Evidence

Both 256-unit canaries were run with FakeTransport (zero real API calls).

## Results

### Study 1 Canary
- Model: claude-haiku-5.5
- Total units: See s1_canary_counts.json
- Arms: benef_org, benef_self, benef_other, none
- Expected: 64 units per model (16 per arm)

### Study 2 Canary
- Model: claude-haiku-5.5
- Total units: See s2_canary_counts.json
- Cells: agent_tools, agent_notools, advisor_tools, advisor_notools
- Expected: 64 units per model (16 per cell)

## Files
- `s1_canary_counts.json`: S1 count breakdown
- `s2_canary_counts.json`: S2 count breakdown
- Logs: `/tmp/s1_canary_run.log`, `/tmp/s2_canary_run.log`
