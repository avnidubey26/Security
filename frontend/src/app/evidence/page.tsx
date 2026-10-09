"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  Eye,
  FileCheck2,
  Fingerprint,
  Link2,
  RefreshCw,
  Search,
  ShieldCheck,
} from "lucide-react";

import { api, ApiError } from "@/lib/api";
import type { Evidence } from "@/types/api";

type EvidenceResponse =
  | Evidence[]
  | {
      items?: Evidence[];
      data?: Evidence[];
      total?: number;
    };

type InvestigationReference = {
  id: string;
};

function normalizeEvidence(response: unknown): Evidence[] {
  if (Array.isArray(response)) {
    return response as Evidence[];
  }

  if (!response || typeof response !== "object") {
    return [];
  }

  const value = response as {
    items?: unknown;
    data?: unknown;
  };

  if (Array.isArray(value.items)) {
    return value.items as Evidence[];
  }

  if (Array.isArray(value.data)) {
    return value.data as Evidence[];
  }

  return [];
}

function normalizeInvestigations(
  response: unknown,
): InvestigationReference[] {
  if (Array.isArray(response)) {
    return response.filter(
      (
        item,
      ): item is InvestigationReference =>
        Boolean(
          item &&
            typeof item === "object" &&
            "id" in item &&
            typeof (item as { id?: unknown }).id ===
              "string",
        ),
    );
  }

  if (!response || typeof response !== "object") {
    return [];
  }

  const value = response as {
    items?: unknown;
    data?: unknown;
  };

  if (Array.isArray(value.items)) {
    return normalizeInvestigations(value.items);
  }

  if (Array.isArray(value.data)) {
    return normalizeInvestigations(value.data);
  }

  return [];
}

function formatDate(
  value: string | null | undefined,
): string {
  if (!value) {
    return "-";
  }

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

function shortId(
  value: string | null | undefined,
): string {
  if (!value) {
    return "-";
  }

  return `${value.slice(0, 8)}...`;
}

function sourceClass(sourceType: string): string {
  switch (sourceType.toUpperCase()) {
    case "ALERT":
      return "badge-danger";
    case "DETECTION_RESULT":
      return "badge-warning";
    case "SECURITY_EVENT":
      return "badge-info";
    case "TIMELINE_ENTRY":
      return "badge-success";
    case "INVESTIGATION_NOTE":
      return "badge-info";
    case "INVESTIGATION_FINDING":
      return "badge-success";
    default:
      return "badge-info";
  }
}

export default function EvidencePage() {
  const [evidence, setEvidence] = useState<Evidence[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(
    null,
  );

  const [search, setSearch] = useState("");
  const [sourceFilter, setSourceFilter] =
    useState("ALL");

  const loadEvidence = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      /*
       * Evidence is currently exposed by investigation.
       * Discover investigations first, then aggregate their
       * evidence records into a single register.
       */
      const investigationsResponse =
        await api.get<unknown>("/investigations");

      const investigations =
        normalizeInvestigations(
          investigationsResponse,
        );

      const collected: Evidence[] = [];

      for (const investigation of investigations) {
        try {
          const response =
            await api.get<EvidenceResponse>(
              `/evidence/investigations/${investigation.id}`,
            );

          collected.push(...normalizeEvidence(response));
        } catch {
          /*
           * Continue processing the remaining investigations.
           * One inaccessible investigation should not prevent
           * the register from loading.
           */
        }
      }

      const unique = new Map<string, Evidence>();

      for (const item of collected) {
        unique.set(item.id, item);
      }

      setEvidence(Array.from(unique.values()));
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Unable to load evidence.");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadEvidence();
  }, [loadEvidence]);

  const sourceTypes = useMemo(() => {
    return Array.from(
      new Set(
        evidence.map((item) =>
          item.source_type.toUpperCase(),
        ),
      ),
    ).sort();
  }, [evidence]);

  const filteredEvidence = useMemo(() => {
    const query = search.trim().toLowerCase();

    return evidence.filter((item) => {
      const matchesSearch =
        !query ||
        item.id.toLowerCase().includes(query) ||
        item.investigation_id
          .toLowerCase()
          .includes(query) ||
        item.source_id.toLowerCase().includes(query) ||
        item.source_type
          .toLowerCase()
          .includes(query) ||
        item.evidence_type
          .toLowerCase()
          .includes(query) ||
        item.title
          ?.toLowerCase()
          .includes(query) ||
        item.description
          ?.toLowerCase()
          .includes(query) ||
        item.integrity_hash
          .toLowerCase()
          .includes(query);

      const matchesSource =
        sourceFilter === "ALL" ||
        item.source_type.toUpperCase() ===
          sourceFilter;

      return matchesSearch && matchesSource;
    });
  }, [evidence, search, sourceFilter]);

  const metrics = useMemo(
    () => ({
      total: evidence.length,
      alerts: evidence.filter(
        (item) =>
          item.source_type.toUpperCase() ===
          "ALERT",
      ).length,
      events: evidence.filter(
        (item) =>
          item.source_type.toUpperCase() ===
          "SECURITY_EVENT",
      ).length,
      findings: evidence.filter(
        (item) =>
          item.source_type.toUpperCase() ===
          "INVESTIGATION_FINDING",
      ).length,
    }),
    [evidence],
  );

  return (
    <div className="content">
      <div className="page-header">
        <div>
          <p className="eyebrow">
            Investigation integrity
          </p>

          <h1>Evidence</h1>

          <p className="page-description">
            Provenance-tracked investigation artifacts
            with integrity hashes and source relationships.
          </p>
        </div>

        <button
          type="button"
          className="button"
          onClick={() => void loadEvidence()}
          disabled={loading}
        >
          <RefreshCw
            size={14}
            className={
              loading ? "loading-icon" : ""
            }
          />
          Refresh
        </button>
      </div>

      <section className="metrics-grid">
        <div className="metric-card">
          <div className="metric-label">
            Evidence items
          </div>

          <div className="metric-value">
            {metrics.total}
          </div>

          <div className="metric-detail">
            Collected investigation artifacts
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-label">
            Alert evidence
          </div>

          <div className="metric-value">
            {metrics.alerts}
          </div>

          <div className="metric-detail">
            Detection-linked artifacts
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-label">
            Event evidence
          </div>

          <div className="metric-value">
            {metrics.events}
          </div>

          <div className="metric-detail">
            Security-event artifacts
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-label">
            Finding evidence
          </div>

          <div className="metric-value">
            {metrics.findings}
          </div>

          <div className="metric-detail">
            Investigation findings
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="panel-header">
          <div className="row">
            <FileCheck2
              size={15}
              color="var(--accent)"
            />

            <span className="panel-title">
              Evidence register
            </span>
          </div>

          <span className="mono-muted">
            {filteredEvidence.length} of{" "}
            {evidence.length}
          </span>
        </div>

        <div className="panel-body">
          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "minmax(240px, 1fr) 220px",
              gap: 10,
            }}
          >
            <label
              className="search-box"
              style={{ width: "100%" }}
            >
              <Search size={14} />

              <input
                type="search"
                placeholder="Search evidence, source, hash..."
                value={search}
                onChange={(event) =>
                  setSearch(event.target.value)
                }
              />
            </label>

            <label className="select-box">
              <Fingerprint size={13} />

              <select
                value={sourceFilter}
                onChange={(event) =>
                  setSourceFilter(event.target.value)
                }
              >
                <option value="ALL">
                  All source types
                </option>

                {sourceTypes.map((source) => (
                  <option
                    value={source}
                    key={source}
                  >
                    {source.replaceAll("_", " ")}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        {error ? (
          <div className="panel-body">
            <div className="error-state">
              <div className="row">
                <AlertCircle size={15} />

                <strong>
                  Unable to load evidence
                </strong>
              </div>

              <div style={{ marginTop: 6 }}>
                {error}
              </div>

              <button
                type="button"
                className="button button-danger"
                style={{ marginTop: 12 }}
                onClick={() =>
                  void loadEvidence()
                }
              >
                <RefreshCw size={13} />
                Retry
              </button>
            </div>
          </div>
        ) : loading ? (
          <div className="panel-body">
            <div className="empty-state compact">
              <Clock3 size={17} />

              <span>
                Loading evidence register...
              </span>
            </div>
          </div>
        ) : filteredEvidence.length === 0 ? (
          <div className="panel-body">
            <div className="empty-state">
              <div>
                <FileCheck2 size={20} />

                <div
                  className="empty-state-title"
                  style={{ marginTop: 10 }}
                >
                  No evidence found
                </div>

                <p className="empty-state-description">
                  {evidence.length === 0
                    ? "No evidence has been collected yet."
                    : "No evidence matches the current filters."}
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Evidence</th>
                  <th>Source</th>
                  <th>Investigation</th>
                  <th>Integrity</th>
                  <th>Collected</th>
                  <th />
                </tr>
              </thead>

              <tbody>
                {filteredEvidence.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <div
                        className="row"
                        style={{ gap: 9 }}
                      >
                        <div
                          style={{
                            width: 30,
                            height: 30,
                            borderRadius: 6,
                            display: "grid",
                            placeItems: "center",
                            border:
                              "1px solid var(--border)",
                            background:
                              "var(--surface-raised)",
                          }}
                        >
                          <FileCheck2
                            size={14}
                            color="var(--accent)"
                          />
                        </div>

                        <div>
                          <div
                            style={{
                              fontWeight: 600,
                            }}
                          >
                            {item.title ??
                              item.evidence_type}
                          </div>

                          <div
                            className="mono-muted"
                            style={{
                              marginTop: 4,
                            }}
                          >
                            {item.evidence_type}
                          </div>
                        </div>
                      </div>
                    </td>

                    <td>
                      <span
                        className={`badge ${sourceClass(
                          item.source_type,
                        )}`}
                      >
                        {item.source_type.replaceAll(
                          "_",
                          " ",
                        )}
                      </span>

                      <div
                        className="mono-muted"
                        style={{ marginTop: 5 }}
                      >
                        {shortId(item.source_id)}
                      </div>
                    </td>

                    <td>
                      <Link
                        href={`/investigations/${item.investigation_id}`}
                        className="inline-link mono"
                      >
                        {shortId(
                          item.investigation_id,
                        )}
                      </Link>
                    </td>

                    <td>
                      <div className="row">
                        <ShieldCheck
                          size={13}
                          color="var(--success)"
                        />

                        <span
                          className="mono-muted"
                          title={item.integrity_hash}
                        >
                          {item.integrity_hash.slice(
                            0,
                            12,
                          )}
                          ...
                        </span>
                      </div>
                    </td>

                    <td className="mono-muted">
                      {formatDate(
                        item.collected_at,
                      )}
                    </td>

                    <td>
                      <Link
                        href={`/evidence/${item.id}`}
                        className="icon-button"
                        aria-label={`Open evidence ${item.id}`}
                        title="Open evidence"
                      >
                        <Eye size={14} />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
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
              Evidence integrity
            </span>
          </div>
        </div>

        <div className="panel-body">
          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 12,
            }}
          >
            <div className="security-control">
              <Fingerprint
                size={16}
                color="var(--accent)"
              />

              <div>
                <strong>Integrity hash</strong>

                <p className="muted">
                  Evidence records retain a SHA-256
                  integrity value.
                </p>
              </div>
            </div>

            <div className="security-control">
              <Link2
                size={16}
                color="var(--accent)"
              />

              <div>
                <strong>Source provenance</strong>

                <p className="muted">
                  Each artifact remains linked to its
                  originating security object.
                </p>
              </div>
            </div>

            <div className="security-control">
              <CheckCircle2
                size={16}
                color="var(--success)"
              />

              <div>
                <strong>Traceability</strong>

                <p className="muted">
                  Evidence remains associated with the
                  investigation that collected it.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

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
        Evidence is treated as an auditable investigation
        artifact.
      </div>
    </div>
  );
}