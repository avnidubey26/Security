"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  AlertCircle,
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  Clock3,
  FileCheck2,
  Fingerprint,
  Link2,
  RefreshCw,
  ShieldAlert,
  UserRound,
} from "lucide-react";

import { api, ApiError } from "@/lib/api";
import type {
  Alert,
  Evidence,
  Incident,
  Investigation,
  InvestigationFinding,
  InvestigationNote,
  SecurityEvent,
  TimelineEntry,
} from "@/types/api";

function formatDate(value: string | null | undefined): string {
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

function severityClass(severity: string): string {
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

type InvestigationEventLink = {
  investigation_id: string;
  security_event_id: string;
  relationship_type: string;
  created_at: string;
};

type InvestigationAlertLink = {
  investigation_id: string;
  alert_id: string;
  relationship_type: string;
  created_at: string;
};

type InvestigationDetailResponse = {
  investigation?: Investigation;
  alerts?: Alert[];
  alert_links?: InvestigationAlertLink[];
  events?: SecurityEvent[];
  event_links?: InvestigationEventLink[];
  timeline?: TimelineEntry[];
  findings?: InvestigationFinding[];
  notes?: InvestigationNote[];
  evidence?: Evidence[];
};

function normalizeList<T>(value: unknown): T[] {
  if (Array.isArray(value)) {
    return value as T[];
  }

  if (!value || typeof value !== "object") {
    return [];
  }

  const object = value as {
    items?: unknown;
    data?: unknown;
  };

  if (Array.isArray(object.items)) {
    return object.items as T[];
  }

  if (Array.isArray(object.data)) {
    return object.data as T[];
  }

  return [];
}

export default function IncidentDetailPage() {
  const params = useParams<{ id: string }>();
  const incidentId = params?.id;

  const [incident, setIncident] = useState<Incident | null>(null);
  const [investigation, setInvestigation] =
    useState<Investigation | null>(null);

  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [events, setEvents] = useState<SecurityEvent[]>([]);
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [findings, setFindings] =
    useState<InvestigationFinding[]>([]);
  const [notes, setNotes] = useState<InvestigationNote[]>([]);
  const [evidence, setEvidence] = useState<Evidence[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadIncident = useCallback(async () => {
    if (!incidentId) return;

    setLoading(true);
    setError(null);

    try {
      const incidentResponse =
        await api.get<Incident>(
          `/incidents/${incidentId}`,
        );

      setIncident(incidentResponse);

      const investigationResponse =
        await api.get<Investigation>(
          `/investigations/${incidentResponse.investigation_id}`,
        );

      setInvestigation(investigationResponse);

      const [
        alertsResponse,
        eventsResponse,
        timelineResponse,
        findingsResponse,
        notesResponse,
        evidenceResponse,
      ] = await Promise.all([
        api.get<unknown>(
          `/investigations/${incidentResponse.investigation_id}/alerts`,
        ),
        api.get<unknown>(
          `/investigations/${incidentResponse.investigation_id}/events`,
        ),
        api.get<unknown>(
          `/investigations/${incidentResponse.investigation_id}/timeline`,
        ),
        api.get<unknown>(
          `/investigations/${incidentResponse.investigation_id}/findings`,
        ),
        api.get<unknown>(
          `/investigations/${incidentResponse.investigation_id}/notes`,
        ),
        api.get<unknown>(
          `/evidence/investigations/${incidentResponse.investigation_id}`,
        ),
      ]);

      const alertLinks =
        normalizeList<InvestigationAlertLink>(
          alertsResponse,
        );

      const eventLinks =
        normalizeList<InvestigationEventLink>(
          eventsResponse,
        );

      setTimeline(
        normalizeList<TimelineEntry>(
          timelineResponse,
        ),
      );

      setFindings(
        normalizeList<InvestigationFinding>(
          findingsResponse,
        ),
      );

      setNotes(
        normalizeList<InvestigationNote>(
          notesResponse,
        ),
      );

      setEvidence(
        normalizeList<Evidence>(
          evidenceResponse,
        ),
      );

      const resolvedAlerts: Alert[] = [];

      for (const link of alertLinks) {
        try {
          const alert = await api.get<Alert>(
            `/alerts/${link.alert_id}`,
          );

          resolvedAlerts.push(alert);
        } catch {
          // Preserve the incident page if an individual
          // linked alert cannot be loaded.
        }
      }

      const resolvedEvents: SecurityEvent[] = [];

      for (const link of eventLinks) {
        try {
          const event =
            await api.get<SecurityEvent>(
              `/events/${link.security_event_id}`,
            );

          resolvedEvents.push(event);
        } catch {
          // Preserve the incident page if an individual
          // linked event cannot be loaded.
        }
      }

      setAlerts(resolvedAlerts);
      setEvents(resolvedEvents);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError(
          "Unable to load the incident workspace.",
        );
      }
    } finally {
      setLoading(false);
    }
  }, [incidentId]);

  useEffect(() => {
    void loadIncident();
  }, [loadIncident]);

  const sortedTimeline = useMemo(
    () =>
      [...timeline].sort(
        (a, b) =>
          a.sequence_number - b.sequence_number,
      ),
    [timeline],
  );

  if (loading) {
    return (
      <div className="content">
        <div className="empty-state">
          <Clock3 size={20} />

          <span>
            Loading incident workspace...
          </span>
        </div>
      </div>
    );
  }

  if (error || !incident) {
    return (
      <div className="content">
        <Link
          href="/incidents"
          className="back-link"
        >
          <ArrowLeft size={14} />
          Back to incidents
        </Link>

        <div className="error-state">
          <div className="row">
            <AlertCircle size={16} />

            <strong>
              Unable to load incident
            </strong>
          </div>

          <div style={{ marginTop: 6 }}>
            {error ?? "Incident not found."}
          </div>

          <button
            type="button"
            className="button button-danger"
            style={{ marginTop: 12 }}
            onClick={() => void loadIncident()}
          >
            <RefreshCw size={13} />
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="content">
      <Link
        href="/incidents"
        className="back-link"
      >
        <ArrowLeft size={14} />
        Incident register
      </Link>

      <div className="page-header">
        <div>
          <p className="eyebrow">
            Incident response workspace
          </p>

          <div className="row" style={{ gap: 10 }}>
            <ShieldAlert
              size={22}
              color="var(--accent)"
            />

            <h1>{incident.title}</h1>
          </div>

          <div
            className="row"
            style={{
              marginTop: 9,
              gap: 10,
              flexWrap: "wrap",
            }}
          >
            <span className="mono-muted">
              {incident.incident_number}
            </span>

            <span
              className={`badge ${statusClass(
                incident.status,
              )}`}
            >
              {incident.status.replaceAll(
                "_",
                " ",
              )}
            </span>

            <span
              className={severityClass(
                incident.severity,
              )}
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 10,
                fontWeight: 600,
                textTransform: "uppercase",
              }}
            >
              {incident.severity}
            </span>
          </div>
        </div>

        <button
          type="button"
          className="button"
          onClick={() => void loadIncident()}
        >
          <RefreshCw size={14} />
          Refresh
        </button>
      </div>

      <section className="panel">
        <div className="panel-header">
          <div className="row">
            <Fingerprint
              size={15}
              color="var(--accent)"
            />

            <span className="panel-title">
              Incident metadata
            </span>
          </div>
        </div>

        <div className="panel-body">
          <div className="detail-grid">
            <div className="detail-item">
              <span>Incident ID</span>
              <strong className="mono">
                {shortId(incident.id)}
              </strong>
            </div>

            <div className="detail-item">
              <span>Investigation</span>

              {investigation ? (
                <Link
                  href={`/investigations/${investigation.id}`}
                  className="inline-link mono"
                >
                  {shortId(investigation.id)}
                </Link>
              ) : (
                <strong className="mono">
                  {shortId(
                    incident.investigation_id,
                  )}
                </strong>
              )}
            </div>

            <div className="detail-item">
              <span>Assigned to</span>

              <strong className="mono">
                {incident.assigned_to ??
                  "Unassigned"}
              </strong>
            </div>

            <div className="detail-item">
              <span>Detected</span>

              <strong>
                {formatDate(incident.detected_at)}
              </strong>
            </div>

            <div className="detail-item">
              <span>Contained</span>

              <strong>
                {formatDate(incident.contained_at)}
              </strong>
            </div>

            <div className="detail-item">
              <span>Resolved</span>

              <strong>
                {formatDate(incident.resolved_at)}
              </strong>
            </div>

            <div className="detail-item">
              <span>Closed</span>

              <strong>
                {formatDate(incident.closed_at)}
              </strong>
            </div>

            <div className="detail-item">
              <span>Last updated</span>

              <strong>
                {formatDate(incident.updated_at)}
              </strong>
            </div>
          </div>

          {incident.description && (
            <div
              className="description-block"
              style={{ marginTop: 18 }}
            >
              <span className="section-label">
                Description
              </span>

              <p>{incident.description}</p>
            </div>
          )}
        </div>
      </section>

      <section className="metrics-grid">
        <div className="metric-card">
          <div className="metric-label">
            Linked alerts
          </div>

          <div className="metric-value">
            {alerts.length}
          </div>

          <div className="metric-detail">
            Detection signals
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-label">
            Security events
          </div>

          <div className="metric-value">
            {events.length}
          </div>

          <div className="metric-detail">
            Investigation telemetry
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-label">
            Timeline entries
          </div>

          <div className="metric-value">
            {timeline.length}
          </div>

          <div className="metric-detail">
            Reconstructed activity
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-label">
            Evidence
          </div>

          <div className="metric-value">
            {evidence.length}
          </div>

          <div className="metric-detail">
            Provenance-tracked artifacts
          </div>
        </div>
      </section>

      <div className="workspace-grid">
        <div>
          <section className="panel">
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
                {sortedTimeline.length} entries
              </span>
            </div>

            <div className="panel-body">
              {sortedTimeline.length === 0 ? (
                <div className="empty-state compact">
                  No timeline entries available.
                </div>
              ) : (
                <div className="timeline">
                  {sortedTimeline.map((entry) => (
                    <div
                      className="timeline-item"
                      key={entry.id}
                    >
                      <div className="timeline-marker">
                        {entry.sequence_number}
                      </div>

                      <div className="timeline-content">
                        <div className="row">
                          <strong>
                            {entry.title}
                          </strong>

                          <span className="mono-muted">
                            {formatDate(
                              entry.occurred_at,
                            )}
                          </span>
                        </div>

                        <div className="timeline-type">
                          {entry.entry_type}
                        </div>

                        {entry.description && (
                          <p>
                            {entry.description}
                          </p>
                        )}

                        <div className="row">
                          {entry.source && (
                            <span className="mono-muted">
                              source: {entry.source}
                            </span>
                          )}

                          <span className="mono-muted">
                            event:{" "}
                            {shortId(
                              entry.security_event_id,
                            )}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
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

            {events.length === 0 ? (
              <div className="panel-body">
                <div className="empty-state compact">
                  No security events linked.
                </div>
              </div>
            ) : (
              <div className="table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Timestamp</th>
                      <th>Type</th>
                      <th>User</th>
                      <th>Source</th>
                      <th>Process</th>
                      <th>Status</th>
                    </tr>
                  </thead>

                  <tbody>
                    {events.map((event) => (
                      <tr key={event.id}>
                        <td className="mono-muted">
                          {formatDate(event.timestamp)}
                        </td>

                        <td>
                          <span className="event-type">
                            {event.event_type}
                          </span>
                        </td>

                        <td className="mono-muted">
                          {event.source_user ?? "-"}
                        </td>

                        <td className="mono-muted">
                          {event.source_ip ?? "-"}
                        </td>

                        <td className="mono-muted">
                          {event.process ?? "-"}
                        </td>

                        <td>
                          {event.status ?? "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>

        <div>
          <section className="panel">
            <div className="panel-header">
              <div className="row">
                <Link2
                  size={15}
                  color="var(--accent)"
                />

                <span className="panel-title">
                  Detection signals
                </span>
              </div>
            </div>

            <div className="panel-body">
              {alerts.length === 0 ? (
                <div className="empty-state compact">
                  No linked alerts.
                </div>
              ) : (
                <div className="stack">
                  {alerts.map((alert) => (
                    <div
                      className="security-item"
                      key={alert.id}
                    >
                      <div className="row">
                        <ShieldAlert
                          size={14}
                          color="var(--accent)"
                        />

                        <strong>
                          {alert.title}
                        </strong>
                      </div>

                      <div
                        className="row"
                        style={{
                          marginTop: 8,
                          flexWrap: "wrap",
                        }}
                      >
                        <span
                          className={severityClass(
                            alert.severity,
                          )}
                        >
                          {alert.severity}
                        </span>

                        <span
                          className={`badge ${statusClass(
                            alert.status,
                          )}`}
                        >
                          {alert.status}
                        </span>

                        <span className="mono-muted">
                          confidence{" "}
                          {alert.confidence}%
                        </span>
                      </div>

                      {alert.explanation && (
                        <p className="muted">
                          {alert.explanation}
                        </p>
                      )}

                      <div className="mono-muted">
                        {formatDate(alert.created_at)}
                      </div>
                    </div>
                  ))}
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
              {findings.length === 0 ? (
                <div className="empty-state compact">
                  No findings recorded.
                </div>
              ) : (
                <div className="stack">
                  {findings.map((finding) => (
                    <div
                      className="security-item"
                      key={finding.id}
                    >
                      <div className="row">
                        <CheckCircle2
                          size={13}
                          color="var(--success)"
                        />

                        <strong>
                          {finding.title}
                        </strong>
                      </div>

                      <div className="mono-muted">
                        {finding.finding_type}
                      </div>

                      {finding.description && (
                        <p className="muted">
                          {finding.description}
                        </p>
                      )}

                      <div className="mono-muted">
                        {formatDate(
                          finding.created_at,
                        )}
                      </div>
                    </div>
                  ))}
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
              {evidence.length === 0 ? (
                <div className="empty-state compact">
                  No evidence collected.
                </div>
              ) : (
                <div className="stack">
                  {evidence.map((item) => (
                    <div
                      className="security-item"
                      key={item.id}
                    >
                      <div className="row">
                        <FileCheck2
                          size={13}
                          color="var(--accent)"
                        />

                        <strong>
                          {item.title ??
                            item.evidence_type}
                        </strong>
                      </div>

                      <div className="mono-muted">
                        {item.source_type} ·{" "}
                        {shortId(item.source_id)}
                      </div>

                      <div className="hash">
                        SHA-256:{" "}
                        {item.integrity_hash}
                      </div>

                      <div className="mono-muted">
                        collected{" "}
                        {formatDate(
                          item.collected_at,
                        )}
                      </div>
                    </div>
                  ))}
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
                <UserRound
                  size={15}
                  color="var(--accent)"
                />

                <span className="panel-title">
                  Investigation notes
                </span>
              </div>
            </div>

            <div className="panel-body">
              {notes.length === 0 ? (
                <div className="empty-state compact">
                  No investigation notes.
                </div>
              ) : (
                <div className="stack">
                  {notes.map((note) => (
                    <div
                      className="security-item"
                      key={note.id}
                    >
                      <p>{note.content}</p>

                      <div className="row">
                        <span className="mono-muted">
                          author:{" "}
                          {note.author_id ??
                            "Unknown"}
                        </span>

                        <span className="mono-muted">
                          {formatDate(
                            note.created_at,
                          )}
                        </span>
                      </div>
                    </div>
                  ))}
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
            <CalendarDays
              size={15}
              color="var(--accent)"
            />

            <span className="panel-title">
              Incident lifecycle
            </span>
          </div>
        </div>

        <div className="panel-body">
          <div className="lifecycle">
            {[
              ["Detected", incident.detected_at],
              ["Contained", incident.contained_at],
              ["Resolved", incident.resolved_at],
              ["Closed", incident.closed_at],
            ].map(([label, timestamp]) => (
              <div
                className="lifecycle-step"
                key={label}
              >
                <div className="lifecycle-marker">
                  <CheckCircle2 size={14} />
                </div>

                <div>
                  <strong>{label}</strong>

                  <div className="mono-muted">
                    {formatDate(timestamp)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}