# Security — MITRE ATT&CK Integration Phase

Adds a versioned local MITRE ATT&CK catalog and evidence-backed mappings for detections, investigations, and timeline entries.

## Current V1 seed
- T1110 — Brute Force
- T1110.001 — Password Guessing
- T1087 — Account Discovery
- T1087.001 — Local Account

The canonical lab scenario is mapped only to techniques supported by its actual telemetry: repeated failed authentication and Linux `id` local-account discovery. Valid Accounts is intentionally not auto-mapped because the current scenario does not establish credential compromise or abuse of a previously valid credential.

Migration: `0006_mitre_attack`, down_revision `0005_attack_timeline`.
