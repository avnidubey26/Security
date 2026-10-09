# Phase 15 — Reporting Engineering

This phase adds on-demand structured investigation reports.

## Integration

Add the reports router import and registration described in `PATCH_MAIN_PY.txt`.

## Endpoint

GET /api/v1/reports/investigations/{investigation_id}

The report is assembled from existing source-of-truth records. No report database table or migration is required.

## Report sections

- investigation
- incident
- alerts
- events
- timeline
- findings
- notes
- evidence
- MITRE ATT&CK techniques
- generated_at
