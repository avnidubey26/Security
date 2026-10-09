"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  Clock3,
  FileCheck2,
  Fingerprint,
  Link2,
  ShieldCheck,
} from "lucide-react";

import { get, post } from "@/lib/api";

interface Evidence {
  id: string;
  investigation_id: string;
  evidence_type: string;
  source_type: string;
  source_id: string;
  title?: string | null;
  description?: string | null;
  snapshot?: Record<string, unknown> | null;
  provenance?: Record<string, unknown> | null;
  integrity_hash: string;
  collected_by: string;
  collected_at: string;
  created_at: string;
}

function formatDate(value?: string | null): string {
  if (!value) return "-";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function shortId(value: string | null | undefined): string {
  if (!value) return "-";
  return `${value.slice(0, 8)}...`;
}

function stringValue(
  value: unknown,
  fallback = "",
): string {
  return typeof value === "string" ? value : fallback;
}

function prettyLabel(value: string): string {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) =>
      character.toUpperCase(),
    );
}

function formatJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function renderValue(value: unknown) {
  if (
    typeof value === "object" &&
    value !== null
  ) {
    return (
      <pre
        className="code-block"
        style={{
          margin: 0,
          overflowX: "auto",
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
        }}
      >
        {formatJson(value)}
      </pre>
    );
  }

  return (
    <span
      className="mono-muted"
      style={{ wordBreak: "break-word" }}
    >
      {String(value)}
    </span>
  );
}

export default function EvidenceDetailPage() {
  const params = useParams<{ id: string }>();
  const evidenceId = params?.id;

  const [evidence, setEvidence] =
    useState<Evidence | null>(null);

  const [loading, setLoading] = useState(true);
  const [verifyLoading, setVerifyLoading] =
    useState(false);

  const [verified, setVerified] =
    useState<boolean | null>(null);

  const [error, setError] = useState<string | null>(
    null,
  );

  const loadEvidence = useCallback(async () => {
    if (!evidenceId) return;

    setLoading(true);
    setError(null);
    setVerified(null);

    try {
      const response =
        await get<Evidence | { data?: Evidence }>(
          `/evidence/${evidenceId}`,
        );

      const payload = response as Evidence & {
        data?: Evidence;
      };

      setEvidence(payload.data ?? payload);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to load evidence.",
      );
    } finally {
      setLoading(false);
    }
  }, [evidenceId]);

  useEffect(() => {
    void loadEvidence();
  }, [loadEvidence]);

  const verifyIntegrity = useCallback(async () => {
    if (!evidenceId || verifyLoading) return;

    setVerifyLoading(true);
    setError(null);
    setVerified(null);

    try {
      const response = await post<{
        verified?: boolean;
        data?: {
          verified?: boolean;
        };
      }>(`/evidence/${evidenceId}/verify`, {});

      const payload = response as {
        verified?: boolean;
        data?: {
          verified?: boolean;
        };
      };

      setVerified(
        typeof payload.verified === "boolean"
          ? payload.verified
          : typeof payload.data?.verified ===
              "boolean"
            ? payload.data.verified
            : null,
      );
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to verify evidence integrity.",
      );
    } finally {
      setVerifyLoading(false);
    }
  }, [evidenceId, verifyLoading]);

  const snapshotEntries = useMemo(() => {
    if (!evidence?.snapshot) return [];
    return Object.entries(evidence.snapshot);
  }, [evidence]);

  const provenanceEntries = useMemo(() => {
    if (!evidence?.provenance) return [];
    return Object.entries(evidence.provenance);
  }, [evidence]);

  if (loading) {
    return (
      <div className="content">
        <div className="empty-state">
          <Clock3 size={20} />
          <span>Loading evidence...</span>
        </div>
      </div>
    );
  }

  if (!evidence) {
    return (
      <div className="content">
        <Link
          href="/evidence"
          className="back-link"
        >
          <ArrowLeft size={14} />
          Back to evidence
        </Link>

        <div
          className="error-state"
          style={{ marginTop: 16 }}
        >
          <div className="row">
            <FileCheck2 size={16} />
            <strong>Evidence not found</strong>
          </div>

          <div style={{ marginTop: 6 }}>
            The requested evidence record could not be
            loaded.
          </div>

          {error && (
            <div style={{ marginTop: 6 }}>
              {error}
            </div>
          )}

          <button
            type="button"
            className="button button-danger"
            style={{ marginTop: 12 }}
            onClick={() => void loadEvidence()}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const evidenceType = prettyLabel(
    stringValue(
      evidence.evidence_type,
      "UNKNOWN",
    ),
  );

  const sourceType = prettyLabel(
    stringValue(evidence.source_type, "UNKNOWN"),
  );

  return (
    <div className="content">
      <Link
        href="/evidence"
        className="back-link"
      >
        <ArrowLeft size={14} />
        Evidence register
      </Link>

      <div className="page-header">
        <div style={{ minWidth: 0 }}>
          <p className="eyebrow">
            Investigation integrity
          </p>

          <div
            className="row"
            style={{
              gap: 10,
              flexWrap: "wrap",
            }}
          >
            <FileCheck2
              size={22}
              color="var(--accent)"
            />

            <h1>
              {evidence.title || "Security Evidence"}
            </h1>
          </div>

          <div
            className="row"
            style={{
              marginTop: 9,
              gap: 9,
              flexWrap: "wrap",
            }}
          >
            <span className="badge badge-success">
              {evidenceType}
            </span>

            <span className="badge badge-info">
              {sourceType}
            </span>

            <span className="mono-muted">
              {shortId(evidence.id)}
            </span>
          </div>

          {evidence.description && (
            <p
              className="page-description"
              style={{
                maxWidth: 850,
                marginTop: 10,
              }}
            >
              {evidence.description}
            </p>
          )}
        </div>

        <button
          type="button"
          className="button"
          onClick={() => void verifyIntegrity()}
          disabled={verifyLoading}
        >
          {verifyLoading ? (
            <Clock3
              size={14}
              className="loading-icon"
            />
          ) : (
            <ShieldCheck size={14} />
          )}

          {verifyLoading
            ? "Verifying..."
            : "Verify Integrity"}
        </button>
      </div>

      {error && (
        <div
          className="error-state"
          style={{ marginBottom: 16 }}
        >
          {error}
        </div>
      )}

      {verified !== null && (
        <section
          className="panel"
          style={{ marginBottom: 16 }}
        >
          <div className="panel-body">
            <div className="row" style={{ gap: 10 }}>
              {verified ? (
                <CheckCircle2
                  size={18}
                  color="var(--success)"
                />
              ) : (
                <Fingerprint
                  size={18}
                  color="var(--danger)"
                />
              )}

              <div>
                <strong>
                  {verified
                    ? "Evidence integrity verified"
                    : "Evidence integrity verification failed"}
                </strong>

                <p
                  className="muted"
                  style={{ marginTop: 4 }}
                >
                  The stored evidence hash was checked
                  against the current evidence record.
                </p>
              </div>
            </div>
          </div>
        </section>
      )}

      <section className="metrics-grid">
        <div className="metric-card">
          <div className="metric-label">
            Evidence type
          </div>

          <div
            className="metric-value"
            style={{ fontSize: 16 }}
          >
            {evidenceType}
          </div>

          <div className="metric-detail">
            Artifact classification
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-label">
            Source
          </div>

          <div
            className="metric-value"
            style={{ fontSize: 16 }}
          >
            {sourceType}
          </div>

          <div className="metric-detail mono-muted">
            {shortId(evidence.source_id)}
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-label">
            Collected
          </div>

          <div
            className="metric-value"
            style={{ fontSize: 14 }}
          >
            {formatDate(evidence.collected_at)}
          </div>

          <div className="metric-detail">
            Evidence collection timestamp
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-label">
            Integrity
          </div>

          <div
            className="metric-value"
            style={{
              fontSize: 16,
              color: "var(--success)",
            }}
          >
            SHA-256
          </div>

          <div className="metric-detail">
            Cryptographic integrity
          </div>
        </div>
      </section>

      <div className="workspace-grid">
        <div>
          <section className="panel">
            <div className="panel-header">
              <div className="row">
                <FileCheck2
                  size={15}
                  color="var(--accent)"
                />

                <span className="panel-title">
                  Evidence snapshot
                </span>
              </div>
            </div>

            <div className="panel-body">
              {snapshotEntries.length > 0 ? (
                <div className="stack">
                  {snapshotEntries.map(
                    ([key, value]) => (
                      <div
                        className="security-item"
                        key={key}
                      >
                        <div className="section-label">
                          {prettyLabel(key)}
                        </div>

                        <div
                          style={{ marginTop: 8 }}
                        >
                          {renderValue(value)}
                        </div>
                      </div>
                    ),
                  )}
                </div>
              ) : (
                <div className="empty-state compact">
                  No snapshot data recorded.
                </div>
              )}
            </div>
          </section>

          <section
            className="panel"
            style={{ marginTop: 16 }}
          >
            <div className="panel-header">
              <div className="row">
                <Link2
                  size={15}
                  color="var(--accent)"
                />

                <span className="panel-title">
                  Provenance
                </span>
              </div>
            </div>

            <div className="panel-body">
              {provenanceEntries.length > 0 ? (
                <div className="stack">
                  {provenanceEntries.map(
                    ([key, value]) => (
                      <div
                        className="security-item"
                        key={key}
                      >
                        <div className="section-label">
                          {prettyLabel(key)}
                        </div>

                        <div
                          style={{ marginTop: 8 }}
                        >
                          {renderValue(value)}
                        </div>
                      </div>
                    ),
                  )}
                </div>
              ) : (
                <div className="empty-state compact">
                  No additional provenance metadata
                  was recorded.
                </div>
              )}
            </div>
          </section>
        </div>

        <div>
          <section className="panel">
            <div className="panel-header">
              <div className="row">
                <ShieldCheck
                  size={15}
                  color="var(--accent)"
                />

                <span className="panel-title">
                  Integrity record
                </span>
              </div>
            </div>

            <div className="panel-body">
              <div className="security-item">
                <div className="section-label">
                  SHA-256 integrity hash
                </div>

                <div
                  className="hash"
                  style={{
                    marginTop: 8,
                    wordBreak: "break-all",
                  }}
                >
                  {evidence.integrity_hash}
                </div>
              </div>

              <div
                className="security-item"
                style={{ marginTop: 12 }}
              >
                <div className="section-label">
                  Source type
                </div>

                <div
                  style={{
                    marginTop: 7,
                    fontWeight: 600,
                  }}
                >
                  {sourceType}
                </div>
              </div>

              <div
                className="security-item"
                style={{ marginTop: 12 }}
              >
                <div className="section-label">
                  Source ID
                </div>

                <div
                  className="mono-muted"
                  style={{
                    marginTop: 7,
                    wordBreak: "break-all",
                  }}
                >
                  {evidence.source_id}
                </div>
              </div>
            </div>
          </section>

          <section
            className="panel"
            style={{ marginTop: 16 }}
          >
            <div className="panel-header">
              <div className="row">
                <Fingerprint
                  size={15}
                  color="var(--accent)"
                />

                <span className="panel-title">
                  Collection metadata
                </span>
              </div>
            </div>

            <div className="panel-body">
              <div className="detail-grid">
                <div className="detail-item">
                  <span>Investigation</span>

                  <Link
                    href={`/investigations/${evidence.investigation_id}`}
                    className="inline-link mono"
                  >
                    {shortId(
                      evidence.investigation_id,
                    )}
                  </Link>
                </div>

                <div className="detail-item">
                  <span>Collected by</span>

                  <strong className="mono">
                    {shortId(evidence.collected_by)}
                  </strong>
                </div>

                <div className="detail-item">
                  <span>Collected at</span>

                  <strong>
                    {formatDate(
                      evidence.collected_at,
                    )}
                  </strong>
                </div>

                <div className="detail-item">
                  <span>Record created</span>

                  <strong>
                    {formatDate(
                      evidence.created_at,
                    )}
                  </strong>
                </div>
              </div>
            </div>
          </section>

          <section
            className="panel"
            style={{ marginTop: 16 }}
          >
            <div className="panel-header">
              <div className="row">
                <ShieldCheck
                  size={15}
                  color="var(--accent)"
                />

                <span className="panel-title">
                  Verification
                </span>
              </div>
            </div>

            <div className="panel-body">
              <p className="muted">
                Evidence retains its source reference,
                collection metadata and cryptographic
                integrity hash so investigators can
                verify provenance during an investigation.
              </p>

              <button
                type="button"
                className="button"
                style={{ marginTop: 14 }}
                onClick={() =>
                  void verifyIntegrity()
                }
                disabled={verifyLoading}
              >
                <Fingerprint size={13} />

                {verifyLoading
                  ? "Running verification..."
                  : "Run verification again"}
              </button>
            </div>
          </section>
        </div>
      </div>

      <div
        className="mono-muted"
        style={{
          marginTop: 14,
          display: "flex",
          alignItems: "center",
          gap: 7,
        }}
      >
        <ShieldCheck size={12} />
        Evidence remains traceable to its originating
        investigation and source object.
      </div>
    </div>
  );
}