# Phase 13 — Controlled Security Lab Expansion

This phase expands the defensive lab from a single scenario into an allowlisted synthetic scenario framework.

## Safety boundary

- Scenario execution mode is `SYNTHETIC`.
- Runners are selected only from an in-code allowlist.
- No user-supplied shell commands are accepted.
- No subprocess execution is introduced.
- No network packets are sent by the new scenarios.
- Scenario parameters are explicitly validated and bounded.
- Every run continues to produce raw telemetry and normalized security events with provenance.

## New scenarios

- `auth-bruteforce-command-execution` — existing seven-event scenario, preserved for compatibility.
- `suspicious-process-chain` — synthetic shell → curl → cat process chain.
- `network-port-sweep` — bounded synthetic connection telemetry for 1–10 ports.

## Migration

`0007_lab_expansion` follows `0006_mitre_attack` and adds execution metadata and parameter schemas to `scenarios`.

## Verification

After replacing the files:

```powershell
docker compose up --build
```

Then verify:

```text
GET /api/v1/scenarios
GET /api/v1/scenarios/{scenario_id}
POST /api/v1/scenarios/{scenario_id}/runs
GET /api/v1/scenarios/{scenario_id}/runs/{run_id}
```

The existing brute-force scenario must still generate seven events. The new scenarios must generate only synthetic telemetry.
