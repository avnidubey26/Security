"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  BookOpen,
  CheckCircle2,
  Clock3,
  FileCheck2,
  FileText,
  Fingerprint,
  RefreshCw,
  Search,
  ShieldAlert,
  Target,
  UserRound,
} from "lucide-react";

import { api, ApiError } from "@/lib/api";
import type {
  Investigation,
  ReportDocument,
} from "@/types/api";

type InvestigationResponse =
  | Investigation[]
  | {
      items?: Investigation[];
      data?: Investigation[];
      total?: number;
    };

function normalizeInvestigations(
  response: unknown,
): Investigation[] {
  if (Array.isArray(response)) {
    return response;
  }

  if (!response || typeof response !== "object") {
    return [];
  }

  const value = response as {
    items?: unknown;
    data?: unknown;
  };

  if (Array.isArray(value.items)) {
    return value.items as Investigation[];
  }

  if (Array.isArray(value.data)) {
    return value.data as Investigation[];
  }

  return [];
}

function normalizeReport(
  response: unknown,
): ReportDocument {
  let payload: Record<string, unknown> | null = null;

  if (response && typeof response === "object") {
    const value = response as Record<string, unknown>;

    if (
      value.data &&
      typeof value.data === "object" &&
      !Array.isArray(value.data)
    ) {
      payload = value.data as Record<string, unknown>;
    } else {
      payload = value;
    }
  }

  if (!payload || !payload.investigation) {
    throw new Error(
      "The investigation report response has an invalid shape.",
    );
  }

  const arrayField = (
    key: keyof ReportDocument,
  ): Record<string, unknown>[] => {
    const value = payload?.[key];

    return Array.isArray(value)
      ? (value as Record<string, unknown>[])
      : [];
  };

  return {
    investigation:
      payload.investigation as ReportDocument["investigation"],
    incident:
      (payload.incident as ReportDocument["incident"]) ??
      null,
    detections: arrayField("detections"),
    alerts: arrayField("alerts"),
    events: arrayField("events"),
    timeline: arrayField("timeline"),
    findings: arrayField("findings"),
    notes: arrayField("notes"),
    evidence: arrayField("evidence"),
    mitre_techniques: arrayField("mitre_techniques"),
    generated_at: String(
      payload.generated_at ?? new Date().toISOString(),
    ),
  };
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

function stringValue(
  value: unknown,
  fallback = "-",
): string {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return fallback;
  }

  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return String(value);
  }

  return fallback;
}

function shortId(value: unknown): string {
  const text = stringValue(value, "");

  if (!text) {
    return "-";
  }

  return text.length > 16
    ? `${text.slice(0, 12)}...`
    : text;
}

function severityClass(
  severity: string,
): string {
  switch (severity.toUpperCase()) {
    case "CRITICAL":
      return "severity-critical";
    case "HIGH":
      return "severity-high";
    case "MEDIUM":
      return "severity-medium";
    case "LOW":
      return "severity-low";
    default:
      return "";
  }
}

function statusClass(status: string): string {
  switch (status.toUpperCase()) {
    case "OPEN":
      return "badge-danger";
    case "CONTAINED":
      return "badge-warning";
    case "RESOLVED":
    case "CLOSED":
      return "badge-success";
    case "FALSE_POSITIVE":
      return "badge-info";
    default:
      return "badge-info";
  }
}

function renderObjectValue(
  value: unknown,
): string {
  if (
    value === null ||
    value === undefined
  ) {
    return "-";
  }

  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return String(value);
  }

  try {
    return JSON.stringify(value);
  } catch {
    return "[unserializable]";
  }
}

function ReportObjectList({
  items,
  emptyMessage,
}: {
  items: Record<string, unknown>[];
  emptyMessage: string;
}) {
  if (items.length === 0) {
    return (
      <div className="empty-state compact">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="stack">
      {items.map((item, index) => {
        const id =
          stringValue(item.id, "") ||
          stringValue(item.event_id, "") ||
          `record-${index}`;

        const title =
          stringValue(item.title, "") ||
          stringValue(item.name, "") ||
          stringValue(
            item.technique_id,
            "",
          ) ||
          stringValue(
            item.event_type,
            "",
          ) ||
          `Record ${index + 1}`;

        const severity = stringValue(
          item.severity,
          "",
        );

        const status = stringValue(
          item.status,
          "",
        );

        return (
          <div
            className="security-item"
            key={`${id}-${index}`}
          >
            <div className="row">
              <strong>{title}</strong>

              {severity && (
                <span
                  className={severityClass(
                    severity,
                  )}
                >
                  {severity}
                </span>
              )}

              {status && (
                <span
                  className={`badge ${statusClass(
                    status,
                  )}`}
                >
                  {status}
                </span>
              )}
            </div>

            <div className="report-object-grid">
              {Object.entries(item)
                .filter(
                  ([key]) =>
                    key !== "snapshot" &&
                    key !== "context" &&
                    key !== "metadata_json" &&
                    key !== "provenance",
                )
                .slice(0, 8)
                .map(([key, value]) => (
                  <div
                    className="report-field"
                    key={key}
                  >
                    <span>
                      {key.replaceAll(
                        "_",
                        " ",
                      )}
                    </span>

                    <strong>
                      {renderObjectValue(
                        value,
                      )}
                    </strong>
                  </div>
                ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function ReportsPage() {
  const [investigations, setInvestigations] =
    useState<Investigation[]>([]);

  const [
    selectedInvestigationId,
    setSelectedInvestigationId,
  ] = useState("");

  const [report, setReport] =
    useState<ReportDocument | null>(null);

  const [
    loadingInvestigations,
    setLoadingInvestigations,
  ] = useState(true);

  const [loadingReport, setLoadingReport] =
    useState(false);

  const [error, setError] =
    useState<string | null>(null);

  const [search, setSearch] =
    useState("");

  const loadInvestigations =
    useCallback(async () => {
      setLoadingInvestigations(true);
      setError(null);

      try {
        const response =
          await api.get<InvestigationResponse>(
            "/investigations",
          );

        const items =
          normalizeInvestigations(
            response,
          );

        setInvestigations(items);

        if (
          items.length > 0 &&
          !selectedInvestigationId
        ) {
          setSelectedInvestigationId(
            items[0].id,
          );
        }
      } catch (err) {
        if (err instanceof ApiError) {
          setError(err.message);
        } else {
          setError(
            "Unable to load investigations.",
          );
        }
      } finally {
        setLoadingInvestigations(false);
      }
    }, [selectedInvestigationId]);

  const loadReport = useCallback(
    async (investigationId: string) => {
      if (!investigationId) {
        setReport(null);
        return;
      }

      setLoadingReport(true);
      setError(null);

      try {
        const response =
          await api.get<unknown>(
            `/reports/investigations/${investigationId}`,
          );

        setReport(normalizeReport(response));
      } catch (err) {
        if (err instanceof ApiError) {
          setError(err.message);
        } else {
          setError(
            "Unable to generate the investigation report.",
          );
        }

        setReport(null);
      } finally {
        setLoadingReport(false);
      }
    },
    [],
  );

  useEffect(() => {
    void loadInvestigations();
  }, [loadInvestigations]);

  useEffect(() => {
    if (selectedInvestigationId) {
      void loadReport(
        selectedInvestigationId,
      );
    }
  }, [
    selectedInvestigationId,
    loadReport,
  ]);

  const filteredInvestigations =
    useMemo(() => {
      const query =
        search.trim().toLowerCase();

      if (!query) {
        return investigations;
      }

      return investigations.filter(
        (investigation) =>
          investigation.title
            .toLowerCase()
            .includes(query) ||
          investigation.id
            .toLowerCase()
            .includes(query) ||
          investigation.status
            .toLowerCase()
            .includes(query) ||
          investigation.priority
            .toLowerCase()
            .includes(query),
      );
    }, [investigations, search]);

  const reportCounts = useMemo(
    () => ({
      detections: Array.isArray(report?.detections)
        ? report.detections.length
        : 0,
      alerts: Array.isArray(report?.alerts)
        ? report.alerts.length
        : 0,
      events: Array.isArray(report?.events)
        ? report.events.length
        : 0,
      timeline: Array.isArray(report?.timeline)
        ? report.timeline.length
        : 0,
      findings: Array.isArray(report?.findings)
        ? report.findings.length
        : 0,
      notes: Array.isArray(report?.notes)
        ? report.notes.length
        : 0,
      evidence: Array.isArray(report?.evidence)
        ? report.evidence.length
        : 0,
      mitre: Array.isArray(report?.mitre_techniques)
        ? report.mitre_techniques.length
        : 0,
    }),
    [report],
  );

  return (
    <div className="content">
      <div className="page-header">
        <div>
          <p className="eyebrow">
            Incident documentation
          </p>

          <div
            className="row"
            style={{ gap: 10 }}
          >
            <FileText
              size={22}
              color="var(--accent)"
            />

            <h1>Reports</h1>
          </div>

          <p className="page-description">
            On-demand investigation reports assembled
            from the platform&apos;s source-of-truth
            records.
          </p>
        </div>

        <button
          type="button"
          className="button"
          onClick={() => {
            void loadInvestigations();

            if (
              selectedInvestigationId
            ) {
              void loadReport(
                selectedInvestigationId,
              );
            }
          }}
          disabled={
            loadingInvestigations ||
            loadingReport
          }
        >
          <RefreshCw
            size={14}
            className={
              loadingInvestigations ||
              loadingReport
                ? "loading-icon"
                : ""
            }
          />
          Refresh
        </button>
      </div>

      <section className="panel">
        <div className="panel-header">
          <div className="row">
            <Search
              size={15}
              color="var(--accent)"
            />

            <span className="panel-title">
              Investigation selector
            </span>
          </div>
        </div>

        <div className="panel-body">
          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "minmax(240px, 1fr) minmax(260px, 2fr)",
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
                placeholder="Filter investigations..."
                value={search}
                onChange={(event) =>
                  setSearch(
                    event.target.value,
                  )
                }
              />
            </label>

            <select
              className="select-control"
              value={
                selectedInvestigationId
              }
              onChange={(event) =>
                setSelectedInvestigationId(
                  event.target.value,
                )
              }
              disabled={
                loadingInvestigations
              }
            >
              <option value="">
                Select an investigation
              </option>

              {filteredInvestigations.map(
                (investigation) => (
                  <option
                    value={investigation.id}
                    key={investigation.id}
                  >
                    {investigation.title} —{" "}
                    {investigation.status}
                  </option>
                ),
              )}
            </select>
          </div>
        </div>
      </section>

      {error && (
        <div
          className="error-state"
          style={{ marginTop: 16 }}
        >
          <div className="row">
            <AlertCircle size={15} />

            <strong>
              Report operation failed
            </strong>
          </div>

          <div style={{ marginTop: 6 }}>
            {error}
          </div>
        </div>
      )}

      {loadingReport ? (
        <div
          className="empty-state"
          style={{ marginTop: 16 }}
        >
          <RefreshCw
            size={19}
            className="loading-icon"
          />

          <span>
            Generating investigation report...
          </span>
        </div>
      ) : report ? (
        <>
          <section
            className="panel"
            style={{ marginTop: 16 }}
          >
            <div className="panel-header">
              <div className="row">
                <FileCheck2
                  size={15}
                  color="var(--accent)"
                />

                <span className="panel-title">
                  Report summary
                </span>
              </div>

              <span className="mono-muted">
                generated{" "}
                {formatDate(
                  report.generated_at,
                )}
              </span>
            </div>

            <div className="panel-body">
              <div className="detail-grid">
                <div className="detail-item">
                  <span>
                    Investigation
                  </span>

                  <strong>
                    {stringValue(
                      report.investigation
                        .title,
                    )}
                  </strong>
                </div>

                <div className="detail-item">
                  <span>Status</span>

                  <strong>
                    {stringValue(
                      report.investigation
                        .status,
                    )}
                  </strong>
                </div>

                <div className="detail-item">
                  <span>Priority</span>

                  <strong>
                    {stringValue(
                      report.investigation
                        .priority,
                    )}
                  </strong>
                </div>

                <div className="detail-item">
                  <span>Incident</span>

                  <strong>
                    {report.incident
                      ? stringValue(
                          report.incident
                            .incident_number,
                          stringValue(
                            report.incident
                              .title,
                            "Linked incident",
                          ),
                        )
                      : "No linked incident"}
                  </strong>
                </div>

                <div className="detail-item">
                  <span>Investigation ID</span>

                  <strong className="mono">
                    {shortId(
                      report.investigation
                        .id,
                    )}
                  </strong>
                </div>

                <div className="detail-item">
                  <span>Generated</span>

                  <strong>
                    {formatDate(
                      report.generated_at,
                    )}
                  </strong>
                </div>
              </div>
            </div>
          </section>

          <section className="metrics-grid">
            <div className="metric-card">
              <div className="metric-label">
                Detections
              </div>

              <div className="metric-value">
                {reportCounts.detections}
              </div>

              <div className="metric-detail">
                Detection results
              </div>
            </div>

            <div className="metric-card">
              <div className="metric-label">
                Alerts
              </div>

              <div className="metric-value">
                {reportCounts.alerts}
              </div>

              <div className="metric-detail">
                Generated security alerts
              </div>
            </div>

            <div className="metric-card">
              <div className="metric-label">
                Events
              </div>

              <div className="metric-value">
                {reportCounts.events}
              </div>

              <div className="metric-detail">
                Correlated security events
              </div>
            </div>

            <div className="metric-card">
              <div className="metric-label">
                Timeline
              </div>

              <div className="metric-value">
                {reportCounts.timeline}
              </div>

              <div className="metric-detail">
                Reconstructed activity
              </div>
            </div>

            <div className="metric-card">
              <div className="metric-label">
                Findings
              </div>

              <div className="metric-value">
                {reportCounts.findings}
              </div>

              <div className="metric-detail">
                Analyst findings
              </div>
            </div>

            <div className="metric-card">
              <div className="metric-label">
                Evidence
              </div>

              <div className="metric-value">
                {reportCounts.evidence}
              </div>

              <div className="metric-detail">
                Integrity-tracked artifacts
              </div>
            </div>
          </section>

          <div className="workspace-grid">
            <div>
              <section className="panel">
                <div className="panel-header">
                  <div className="row">
                    <ShieldAlert
                      size={15}
                      color="var(--accent)"
                    />

                    <span className="panel-title">
                      Detection chain
                    </span>
                  </div>
                </div>

                <div className="panel-body">
                  <ReportObjectList
                    items={
                      report.detections
                    }
                    emptyMessage="No detection results in this report."
                  />
                </div>
              </section>

              <section
                className="panel"
                style={{ marginTop: 16 }}
              >
                <div className="panel-header">
                  <div className="row">
                    <Clock3
                      size={15}
                      color="var(--accent)"
                    />

                    <span className="panel-title">
                      Attack timeline
                    </span>
                  </div>

                  <span className="mono-muted">
                    {reportCounts.timeline} entries
                  </span>
                </div>

                <div className="panel-body">
                  {report.timeline.length ===
                  0 ? (
                    <div className="empty-state compact">
                      No timeline entries.
                    </div>
                  ) : (
                    <div className="timeline">
                      {report.timeline.map(
                        (
                          item,
                          index,
                        ) => (
                          <div
                            className="timeline-item"
                            key={String(
                              item.id ??
                                item.sequence_number ??
                                index,
                            )}
                          >
                            <div className="timeline-marker">
                              {stringValue(
                                item.sequence_number,
                                String(
                                  index + 1,
                                ),
                              )}
                            </div>

                            <div className="timeline-content">
                              <div className="row">
                                <strong>
                                  {stringValue(
                                    item.title,
                                    stringValue(
                                      item.entry_type,
                                      "Timeline event",
                                    ),
                                  )}
                                </strong>

                                <span className="mono-muted">
                                  {formatDate(
                                    stringValue(
                                      item.occurred_at,
                                      "",
                                    ),
                                  )}
                                </span>
                              </div>

                              {stringValue(
                                item.description,
                                "",
                              ) && (
                                <p>
                                  {stringValue(
                                    item.description,
                                  )}
                                </p>
                              )}

                              <span className="timeline-type">
                                {stringValue(
                                  item.entry_type,
                                )}
                              </span>
                            </div>
                          </div>
                        ),
                      )}
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
                    <AlertCircle
                      size={15}
                      color="var(--accent)"
                    />

                    <span className="panel-title">
                      Security events
                    </span>
                  </div>
                </div>

                <div className="panel-body">
                  <ReportObjectList
                    items={report.events}
                    emptyMessage="No security events in this report."
                  />
                </div>
              </section>
            </div>

            <div>
              <section className="panel">
                <div className="panel-header">
                  <div className="row">
                    <ShieldAlert
                      size={15}
                      color="var(--accent)"
                    />

                    <span className="panel-title">
                      Alerts
                    </span>
                  </div>
                </div>

                <div className="panel-body">
                  <ReportObjectList
                    items={report.alerts}
                    emptyMessage="No alerts in this report."
                  />
                </div>
              </section>

              <section
                className="panel"
                style={{ marginTop: 16 }}
              >
                <div className="panel-header">
                  <div className="row">
                    <CheckCircle2
                      size={15}
                      color="var(--accent)"
                    />

                    <span className="panel-title">
                      Findings
                    </span>
                  </div>
                </div>

                <div className="panel-body">
                  <ReportObjectList
                    items={
                      report.findings
                    }
                    emptyMessage="No findings recorded."
                  />
                </div>
              </section>

              <section
                className="panel"
                style={{ marginTop: 16 }}
              >
                <div className="panel-header">
                  <div className="row">
                    <UserRound
                      size={15}
                      color="var(--accent)"
                    />

                    <span className="panel-title">
                      Analyst notes
                    </span>
                  </div>
                </div>

                <div className="panel-body">
                  {report.notes.length ===
                  0 ? (
                    <div className="empty-state compact">
                      No investigation notes.
                    </div>
                  ) : (
                    <div className="stack">
                      {report.notes.map(
                        (
                          note,
                          index,
                        ) => (
                          <div
                            className="security-item"
                            key={String(
                              note.id ??
                                index,
                            )}
                          >
                            <p>
                              {stringValue(
                                note.content,
                                stringValue(
                                  note.description,
                                  "No note content.",
                                ),
                              )}
                            </p>

                            <div className="row">
                              <span className="mono-muted">
                                author:{" "}
                                {stringValue(
                                  note.author_id,
                                  "Unknown",
                                )}
                              </span>

                              <span className="mono-muted">
                                {formatDate(
                                  stringValue(
                                    note.created_at,
                                    "",
                                  ),
                                )}
                              </span>
                            </div>
                          </div>
                        ),
                      )}
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
                    <FileCheck2
                      size={15}
                      color="var(--accent)"
                    />

                    <span className="panel-title">
                      Evidence
                    </span>
                  </div>
                </div>

                <div className="panel-body">
                  {report.evidence.length ===
                  0 ? (
                    <div className="empty-state compact">
                      No evidence collected.
                    </div>
                  ) : (
                    <div className="stack">
                      {report.evidence.map(
                        (
                          item,
                          index,
                        ) => {
                          const integrityHash =
                            stringValue(
                              item.integrity_hash,
                              "",
                            );

                          return (
                            <div
                              className="security-item"
                              key={String(
                                item.id ??
                                  index,
                              )}
                            >
                              <div className="row">
                                <Fingerprint
                                  size={13}
                                  color="var(--accent)"
                                />

                                <strong>
                                  {stringValue(
                                    item.title,
                                    stringValue(
                                      item.evidence_type,
                                      "Evidence",
                                    ),
                                  )}
                                </strong>
                              </div>

                              <div className="mono-muted">
                                {stringValue(
                                  item.source_type,
                                )}{" "}
                                {" · "}{" "}
                                {shortId(
                                  item.source_id,
                                )}
                              </div>

                              {integrityHash && (
                                <div className="hash">
                                  SHA-256:{" "}
                                  {integrityHash}
                                </div>
                              )}

                              <div className="mono-muted">
                                collected{" "}
                                {formatDate(
                                  stringValue(
                                    item.collected_at,
                                    "",
                                  ),
                                )}
                              </div>
                            </div>
                          );
                        },
                      )}
                    </div>
                  )}
                </div>
              </section>
            </div>
          </div>

          <section
            className="panel"
            style={{ marginTop: 16 }}
          >
            <div className="panel-header">
              <div className="row">
                <Target
                  size={15}
                  color="var(--accent)"
                />

                <span className="panel-title">
                  MITRE ATT&CK
                </span>
              </div>

              <span className="mono-muted">
                {reportCounts.mitre} techniques
              </span>
            </div>

            <div className="panel-body">
              {report.mitre_techniques
                .length === 0 ? (
                <div className="empty-state compact">
                  No MITRE ATT&CK techniques mapped.
                </div>
              ) : (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns:
                      "repeat(auto-fit, minmax(260px, 1fr))",
                    gap: 10,
                  }}
                >
                  {report.mitre_techniques.map(
                    (
                      technique,
                      index,
                    ) => (
                      <div
                        className="security-control"
                        key={String(
                          technique.id ??
                            technique.technique_id ??
                            index,
                        )}
                      >
                        <Target
                          size={16}
                          color="var(--accent)"
                        />

                        <div>
                          <strong>
                            {stringValue(
                              technique.technique_id,
                              "Technique",
                            )}{" "}
                            —{" "}
                            {stringValue(
                              technique.name,
                              "Unknown",
                            )}
                          </strong>

                          <p className="muted">
                            {stringValue(
                              technique.tactic,
                              "ATT&CK mapping",
                            )}
                          </p>
                        </div>
                      </div>
                    ),
                  )}
                </div>
              )}
            </div>
          </section>

          {report.incident && (
            <section
              className="panel"
              style={{ marginTop: 16 }}
            >
              <div className="panel-header">
                <div className="row">
                  <CheckCircle2
                    size={15}
                    color="var(--accent)"
                  />

                  <span className="panel-title">
                    Incident record
                  </span>
                </div>
              </div>

              <div className="panel-body">
                <div className="detail-grid">
                  <div className="detail-item">
                    <span>
                      Incident number
                    </span>

                    <strong className="mono">
                      {stringValue(
                        report.incident
                          .incident_number,
                      )}
                    </strong>
                  </div>

                  <div className="detail-item">
                    <span>Title</span>

                    <strong>
                      {stringValue(
                        report.incident
                          .title,
                      )}
                    </strong>
                  </div>

                  <div className="detail-item">
                    <span>Severity</span>

                    <strong
                      className={severityClass(
                        stringValue(
                          report.incident
                            .severity,
                        ),
                      )}
                    >
                      {stringValue(
                        report.incident
                          .severity,
                      )}
                    </strong>
                  </div>

                  <div className="detail-item">
                    <span>Status</span>

                    <strong>
                      {stringValue(
                        report.incident
                          .status,
                      )}
                    </strong>
                  </div>

                  <div className="detail-item">
                    <span>Detected</span>

                    <strong>
                      {formatDate(
                        stringValue(
                          report.incident
                            .detected_at,
                          "",
                        ),
                      )}
                    </strong>
                  </div>

                  <div className="detail-item">
                    <span>Closed</span>

                    <strong>
                      {formatDate(
                        stringValue(
                          report.incident
                            .closed_at,
                          "",
                        ),
                      )}
                    </strong>
                  </div>
                </div>
              </div>
            </section>
          )}

          <div
            className="mono-muted"
            style={{
              marginTop: 14,
              display: "flex",
              alignItems: "center",
              gap: 7,
            }}
          >
            <BookOpen size={12} />

            This report is generated on demand from
            investigation source records.
          </div>
        </>
      ) : (
        <div
          className="empty-state"
          style={{ marginTop: 16 }}
        >
          <FileText size={20} />

          <div>
            <div className="empty-state-title">
              Select an investigation
            </div>

            <p className="empty-state-description">
              Choose an investigation to generate its
              structured security report.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}