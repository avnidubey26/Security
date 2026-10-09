# Security — Phase 14: Evidence + Incident Management

## Scope

This phase adds evidence-backed investigation support and structured incident management on top of the completed telemetry, detection, alert, investigation, timeline, MITRE ATT&CK, and controlled-lab layers.

## Evidence

Evidence is intentionally immutable and traceable to an existing investigation source.

Supported sources:

- ALERT
- DETECTION_RESULT
- SECURITY_EVENT
- TIMELINE_ENTRY
- INVESTIGATION_NOTE
- INVESTIGATION_FINDING

Each evidence record stores:

- source identity
- investigation identity
- immutable snapshot
- provenance metadata
- collector identity
- collection timestamp
- SHA-256 integrity hash

Evidence collection is idempotent for the same investigation/source pair.

## Incidents

An incident belongs to exactly one investigation in V1. Creating an incident automatically relates the investigation's existing alerts.

Lifecycle:

`OPEN -> CONTAINED -> RESOLVED -> CLOSED`

A controlled false-positive path is also supported.

Incident numbers use a PostgreSQL sequence and are generated in the form:

`SEC-YYYY-000001`

## API

### Evidence

- `POST /api/v1/evidence`
- `GET /api/v1/evidence/investigations/{investigation_id}`
- `GET /api/v1/evidence/{evidence_id}`
- `POST /api/v1/evidence/{evidence_id}/verify`

### Incidents

- `POST /api/v1/incidents`
- `GET /api/v1/incidents`
- `GET /api/v1/incidents/{incident_id}`
- `PATCH /api/v1/incidents/{incident_id}`
- `POST /api/v1/incidents/{incident_id}/evidence`

## Migration

`0008_evidence_incidents` follows `0007_lab_expansion`.

No external services or paid dependencies are introduced.
