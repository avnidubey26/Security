"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Activity,
  AlertCircle,
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock3,
  FileSearch,
  Flag,
  RefreshCw,
  ScrollText,
  Shield,
  ShieldAlert,
  Target,
  UserRound,
} from "lucide-react";

import { api, ApiError } from "@/lib/api";
import type {
  Evidence,
  Investigation,
  InvestigationAlert,
  InvestigationEvent,
  InvestigationFinding,
  InvestigationMitreMapping,
  InvestigationNote,
  SecurityEvent,
  TimelineEntry,
} from "@/types/api";

type ListResponse<T> =
  | T[]
  | {
    items?: T[];
    data?: T[];
    total?: number;
  };

function normalizeList<T>(response: unknown): T[] {
  if (Array.isArray(response)) {
    return response as T[];
  }

  if (!response || typeof response !== "object") {
    return [];
  }

  const value = response as {
    items?: unknown;
    data?: unknown;
  };

  if (Array.isArray(value.items)) {
    return value.items as T[];
  }

  if (Array.isArray(value.data)) {
    return value.data as T[];
  }

  return [];
}

function formatDate(value: string | null | undefined): string {
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

function formatShortId(id: string | null | undefined): string {
  if (!id) {
    return "-";
  }

  return `${id.slice(0, 8)}...`;
}

function statusClass(status: Investigation["status"]): string {
  switch (status) {
    case "OPEN":
      return "badge-danger";
    case "IN_PROGRESS":
      return "badge-warning";
    case "CONTAINED":
      return "badge-info";
    case "CLOSED":
      return "badge-success";
    default:
      return "";
  }
}

function priorityClass(priority: Investigation["priority"]): string {
  switch (priority) {
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

function eventTypeLabel(value: string | null | undefined): string {
  if (!value) return "Unknown event";
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function getTimelineTone(entryType: string): string {
  switch (entryType) {
    case "AUTHENTICATION_FAILED":
      return "timeline-danger";
    case "AUTHENTICATION_SUCCESS":
      return "timeline-success";
    case "PROCESS_EXECUTION":
      return "timeline-warning";
    default:
      return "";
  }
}

function getEventIcon(entryType: string) {
  switch (entryType) {
    case "AUTHENTICATION_FAILED":
      return ShieldAlert;
    case "AUTHENTICATION_SUCCESS":
      return CheckCircle2;
    case "PROCESS_EXECUTION":
      return Activity;
    default:
      return Activity;
  }
}

export default function InvestigationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [investigationId, setInvestigationId] = useState<string | null>(null);

  const [investigation, setInvestigation] =
    useState<Investigation | null>(null);

  const [alerts, setAlerts] = useState<InvestigationAlert[]>([]);
  const [events, setEvents] = useState<SecurityEvent[]>([]);
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [findings, setFindings] = useState<InvestigationFinding[]>([]);
  const [notes, setNotes] = useState<InvestigationNote[]>([]);
  const [evidence, setEvidence] = useState<Evidence[]>([]);
  const [mitreMappings, setMitreMappings] = useState<
    InvestigationMitreMapping[]
  >([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void params.then(({ id }) => {
      setInvestigationId(id);
    });
  }, [params]);

  const loadInvestigation = useCallback(async () => {
    if (!investigationId) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const [
        investigationResponse,
        alertsResponse,
        eventsResponse,
        timelineResponse,
        findingsResponse,
        notesResponse,
        evidenceResponse,
        mitreResponse,
      ] = await Promise.all([
        api.get<Investigation>(`/investigations/${investigationId}`),

        api.get<ListResponse<InvestigationAlert>>(
          `/investigations/${investigationId}/alerts`,
        ),

        api.get<ListResponse<InvestigationEvent>>(
          `/investigations/${investigationId}/events`,
        ),

        api.get<ListResponse<TimelineEntry>>(
          `/investigations/${investigationId}/timeline`,
        ),

        api.get<ListResponse<InvestigationFinding>>(
          `/investigations/${investigationId}/findings`,
        ),

        api.get<ListResponse<InvestigationNote>>(
          `/investigations/${investigationId}/notes`,
        ),

        api.get<ListResponse<Evidence>>(
          `/evidence/investigations/${investigationId}`,
        ),

        api.get<ListResponse<InvestigationMitreMapping>>(
          `/mitre/investigations/${investigationId}/mappings`,
        ),
      ]);

      const responseData =
        investigationResponse &&
          typeof investigationResponse === "object" &&
          "data" in investigationResponse
          ? investigationResponse.data
          : investigationResponse;

      if (
        !responseData ||
        typeof responseData !== "object" ||
        !("id" in responseData) ||
        !("status" in responseData) ||
        !("title" in responseData)
      ) {
        throw new Error("Invalid investigation response from API.");
      }

      setInvestigation(responseData as Investigation);
      setAlerts(normalizeList<InvestigationAlert>(alertsResponse));

      setEvents(
        normalizeList<InvestigationEvent>(eventsResponse).map(
          (item) => item as unknown as SecurityEvent,
        ),
      );

      setTimeline(normalizeList<TimelineEntry>(timelineResponse));
      setFindings(
        normalizeList<InvestigationFinding>(findingsResponse),
      );
      setNotes(normalizeList<InvestigationNote>(notesResponse));
      setEvidence(normalizeList<Evidence>(evidenceResponse));
      setMitreMappings(
        normalizeList<InvestigationMitreMapping>(mitreResponse),
      );
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Unable to load the investigation workspace.");
      }
    } finally {
      setLoading(false);
    }
  }, [investigationId]);

  useEffect(() => {
    void loadInvestigation();
  }, [loadInvestigation]);

  const orderedTimeline = useMemo(
    () =>
      [...timeline].sort(
        (first, second) =>
          first.sequence_number - second.sequence_number,
      ),
    [timeline],
  );

  const failedEvents = useMemo(
    () =>
      orderedTimeline.filter(
        (entry) => entry.entry_type === "AUTHENTICATION_FAILED",
      ).length,
    [orderedTimeline],
  );

  const successfulEvents = useMemo(
    () =>
      orderedTimeline.filter(
        (entry) => entry.entry_type === "AUTHENTICATION_SUCCESS",
      ).length,
    [orderedTimeline],
  );

  const processEvents = useMemo(
    () =>
      orderedTimeline.filter(
        (entry) => entry.entry_type === "PROCESS_EXECUTION",
      ).length,
    [orderedTimeline],
  );

  if (!investigationId || loading) {
    return (
      <div className="content">
        <div className="empty-state">
          <div>
            <Clock3 size={20} />

            <div
              className="empty-state-title"
              style={{ marginTop: 10 }}
            >
              Loading investigation
            </div>

            <p className="empty-state-description">
              Building the investigation workspace from the security API.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !investigation) {
    return (
      <div className="content">
        <div className="page-header">
          <Link href="/investigations" className="button">
            <ArrowLeft size={14} />
            Investigations
          </Link>
        </div>

        <div className="error-state">
          <div className="row">
            <AlertCircle size={16} />
            <strong>Investigation unavailable</strong>
          </div>

          <div style={{ marginTop: 6 }}>
            {error ?? "The requested investigation could not be found."}
          </div>

          <button
            type="button"
            className="button button-danger"
            style={{ marginTop: 12 }}
            onClick={() => void loadInvestigation()}
          >
            <RefreshCw size={13} />
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="content investigation-workspace">
      <div className="investigation-header">
        <div className="investigation-header-main">
          <Link
            href="/investigations"
            className="investigation-back-link"
          >
            <ArrowLeft size={13} />
            Back to investigations
          </Link>

          <div className="investigation-heading-row">
            <div>
              <p className="eyebrow">INVESTIGATION WORKSPACE</p>

              <h1>{investigation.title}</h1>

              <div className="investigation-header-meta">
                <span
                  className={`badge ${statusClass(
                    investigation.status,
                  )}`}
                >
                  {investigation.status.replaceAll("_", " ")}
                </span>

                <span
                  className={`investigation-priority ${priorityClass(
                    investigation.priority,
                  )}`}
                >
                  {investigation.priority} priority
                </span>

                <span className="mono-muted">
                  {formatShortId(investigation.id)}
                </span>
              </div>
            </div>

            <div className="investigation-state">
              <span className="investigation-state-label">
                CASE STATE
              </span>

              <strong>
                {investigation.status.replaceAll("_", " ")}
              </strong>

              <span>
                {investigation.closed_at
                  ? `Closed ${formatDate(investigation.closed_at)}`
                  : "Analyst investigation active"}
              </span>
            </div>
          </div>
        </div>

        <button
          type="button"
          className="button"
          onClick={() => void loadInvestigation()}
          disabled={loading}
        >
          <RefreshCw
            size={14}
            className={loading ? "loading-icon" : ""}
          />
          Refresh
        </button>
      </div>

      <section className="metrics-grid investigation-metrics">
        <div className="metric-card">
          <div className="metric-label">Linked alerts</div>
          <div className="metric-value">{alerts.length}</div>
          <div className="metric-detail">Detection signals</div>
        </div>

        <div className="metric-card">
          <div className="metric-label">Security events</div>
          <div className="metric-value">{events.length}</div>
          <div className="metric-detail">Investigation evidence</div>
        </div>

        <div className="metric-card">
          <div className="metric-label">Timeline entries</div>
          <div className="metric-value">{timeline.length}</div>
          <div className="metric-detail">Reconstructed activity</div>
        </div>

        <div className="metric-card">
          <div className="metric-label">Evidence items</div>
          <div className="metric-value">{evidence.length}</div>
          <div className="metric-detail">Integrity-tracked records</div>
        </div>
      </section>

      <section className="investigation-overview-grid">
        <section className="panel investigation-context-panel">
          <div className="panel-header">
            <div>
              <span className="panel-kicker">CASE CONTEXT</span>
              <h2>Investigation context</h2>
            </div>

            <Shield size={15} color="var(--accent)" />
          </div>

          <div className="panel-body">
            <div className="investigation-context-grid">
              <div className="investigation-context-item">
                <span>Assigned analyst</span>

                <strong>
                  <UserRound size={13} />
                  {investigation.assigned_to ?? "Unassigned"}
                </strong>
              </div>

              <div className="investigation-context-item">
                <span>Started</span>

                <strong>
                  <CalendarDays size={13} />
                  {formatDate(investigation.started_at)}
                </strong>
              </div>

              <div className="investigation-context-item">
                <span>Last updated</span>

                <strong>
                  <Clock3 size={13} />
                  {formatDate(investigation.updated_at)}
                </strong>
              </div>

              <div className="investigation-context-item">
                <span>Closed</span>

                <strong>
                  <CheckCircle2 size={13} />
                  {formatDate(investigation.closed_at)}
                </strong>
              </div>
            </div>

            {investigation.description ? (
              <div className="investigation-description">
                <span>Description</span>
                <p>{investigation.description}</p>
              </div>
            ) : null}
          </div>
        </section>

        <section className="panel investigation-signal-panel">
          <div className="panel-header">
            <div>
              <span className="panel-kicker">OBSERVED SIGNAL</span>
              <h2>Activity summary</h2>
            </div>

            <Activity size={15} color="var(--accent)" />
          </div>

          <div className="investigation-signal-list">
            <div className="investigation-signal-item">
              <span className="signal-marker danger" />
              <div>
                <strong>{failedEvents} failed authentications</strong>
                <span>Credential access activity</span>
              </div>
            </div>

            <div className="investigation-signal-item">
              <span className="signal-marker success" />
              <div>
                <strong>{successfulEvents} successful authentication</strong>
                <span>Account access observed</span>
              </div>
            </div>

            <div className="investigation-signal-item">
              <span className="signal-marker warning" />
              <div>
                <strong>{processEvents} process execution</strong>
                <span>Identity discovery activity</span>
              </div>
            </div>
          </div>
        </section>
      </section>

      <section className="investigation-primary-grid">
        <section className="panel investigation-timeline-panel">
          <div className="panel-header">
            <div>
              <span className="panel-kicker">
                ATTACK RECONSTRUCTION
              </span>
              <h2>Attack timeline</h2>
            </div>

            <span className="timeline-range">
              {orderedTimeline.length} correlated events
            </span>
          </div>

          <div className="panel-body">
            {orderedTimeline.length === 0 ? (
              <div className="empty-state">
                <div>
                  <Activity size={18} />

                  <div
                    className="empty-state-title"
                    style={{ marginTop: 10 }}
                  >
                    No timeline activity
                  </div>

                  <p className="empty-state-description">
                    Timeline entries will appear as investigation activity
                    is reconstructed.
                  </p>
                </div>
              </div>
            ) : (
              <div className="investigation-timeline">
                {orderedTimeline.map((entry) => {
                  const EventIcon = getEventIcon(entry.entry_type);

                  return (
                    <div
                      className={`investigation-timeline-entry ${getTimelineTone(
                        entry.entry_type,
                      )}`}
                      key={entry.id}
                    >
                      <div className="investigation-timeline-marker">
                        <span>{entry.sequence_number}</span>
                      </div>

                      <div className="investigation-timeline-content">
                        <div className="investigation-timeline-top">
                          <div className="investigation-event-heading">
                            <div className="investigation-event-icon">
                              <EventIcon size={13} />
                            </div>

                            <div>
                              <strong>{entry.title}</strong>

                              <div className="investigation-event-type">
                                {eventTypeLabel(entry.entry_type)}
                              </div>
                            </div>
                          </div>

                          <span className="mono-muted">
                            {formatDate(entry.occurred_at)}
                          </span>
                        </div>

                        {entry.description ? (
                          <p className="investigation-event-description">
                            {entry.description}
                          </p>
                        ) : null}

                        {entry.source ? (
                          <div className="investigation-event-source">
                            <span>SOURCE</span>
                            <code>{entry.source}</code>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        <div className="investigation-side-stack">
          <section className="panel">
            <div className="panel-header">
              <div>
                <span className="panel-kicker">DETECTION LINK</span>
                <h2>Linked alerts</h2>
              </div>

              <ShieldAlert size={15} color="var(--accent)" />
            </div>

            <div className="panel-body">
              {alerts.length === 0 ? (
                <div className="empty-state compact">
                  <span>No linked alerts.</span>
                </div>
              ) : (
                <div className="investigation-alert-list">
                  {alerts.map((item) => (
                    <div
                      key={item.alert_id}
                      className="investigation-alert-item"
                    >
                      <div className="investigation-alert-icon">
                        <Flag size={13} />
                      </div>

                      <div>
                        <span className="mono-muted">
                          {formatShortId(item.alert_id)}
                        </span>

                        <strong>
                          {item.relationship_type}
                        </strong>
                      </div>

                      <ChevronRight size={13} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>

          <section className="panel">
            <div className="panel-header">
              <div>
                <span className="panel-kicker">ATT&CK MAPPING</span>
                <h2>MITRE ATT&CK</h2>
              </div>

              <span className="mono-muted">
                {mitreMappings.length}
              </span>
            </div>

            <div className="panel-body">
              {mitreMappings.length === 0 ? (
                <div className="empty-state compact">
                  <span>No ATT&CK mappings.</span>
                </div>
              ) : (
                <div className="investigation-mitre-list">
                  {mitreMappings.map((mapping) => (
                    <Link
                      href="/mitre"
                      key={`${mapping.investigation_id}-${mapping.technique_id}`}
                      className="investigation-mitre-item"
                    >
                      <div className="investigation-mitre-icon">
                        <Target size={13} />
                      </div>

                      <div>
                        <span>{mapping.technique_id}</span>

                        <strong>
                          {mapping.mapping_type ??
                            "INVESTIGATION MAPPING"}
                        </strong>

                        {mapping.confidence !== null &&
                          mapping.confidence !== undefined ? (
                          <small>
                            Confidence {mapping.confidence}%
                          </small>
                        ) : null}
                      </div>

                      <ChevronRight size={13} />
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </section>
        </div>
      </section>

      <section className="investigation-record-grid">
        <section className="panel">
          <div className="panel-header">
            <div>
              <span className="panel-kicker">ANALYST ASSESSMENT</span>
              <h2>Findings</h2>
            </div>

            <span className="mono-muted">{findings.length}</span>
          </div>

          <div className="panel-body">
            {findings.length === 0 ? (
              <div className="empty-state compact">
                <span>No findings recorded.</span>
              </div>
            ) : (
              <div className="investigation-record-list">
                {findings.map((finding) => (
                  <article
                    key={finding.id}
                    className="investigation-finding"
                  >
                    <div className="investigation-record-icon">
                      <CheckCircle2 size={13} />
                    </div>

                    <div>
                      <strong>{finding.title}</strong>

                      <span>{finding.finding_type}</span>

                      <p>
                        {finding.description ??
                          "No description provided."}
                      </p>

                      <small>
                        {formatDate(finding.created_at)}
                      </small>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="panel">
          <div className="panel-header">
            <div>
              <span className="panel-kicker">CASE JOURNAL</span>
              <h2>Analyst notes</h2>
            </div>

            <span className="mono-muted">{notes.length}</span>
          </div>

          <div className="panel-body">
            {notes.length === 0 ? (
              <div className="empty-state compact">
                <span>No analyst notes recorded.</span>
              </div>
            ) : (
              <div className="investigation-record-list">
                {notes.map((note) => (
                  <article
                    key={note.id}
                    className="investigation-note"
                  >
                    <p>{note.content}</p>

                    <div className="investigation-note-meta">
                      <UserRound size={12} />
                      {note.author_id ?? "Unknown analyst"}
                      <span>â€¢</span>
                      {formatDate(note.created_at)}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="panel">
          <div className="panel-header">
            <div>
              <span className="panel-kicker">CHAIN OF CUSTODY</span>
              <h2>Evidence</h2>
            </div>

            <span className="mono-muted">{evidence.length}</span>
          </div>

          <div className="panel-body">
            {evidence.length === 0 ? (
              <div className="empty-state compact">
                <span>No evidence collected.</span>
              </div>
            ) : (
              <div className="investigation-evidence-list">
                {evidence.map((item) => (
                  <article
                    key={item.id}
                    className="investigation-evidence-item"
                  >
                    <div className="investigation-record-icon">
                      <FileSearch size={13} />
                    </div>

                    <div>
                      <strong>
                        {item.title ?? "Evidence item"}
                      </strong>

                      <span>
                        {item.source_type} Â·{" "}
                        {formatShortId(item.source_id)}
                      </span>

                      {item.integrity_hash ? (
                        <code>
                          SHA-256: {item.integrity_hash}
                        </code>
                      ) : null}

                      <small>
                        Collected {formatDate(item.collected_at)}
                      </small>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        </section>
      </section>

      <section className="panel investigation-events-panel">
        <div className="panel-header">
          <div>
            <span className="panel-kicker">RAW INVESTIGATION CONTEXT</span>
            <h2>Security events</h2>
          </div>

          <span className="mono-muted">
            {events.length} events
          </span>
        </div>

        <div className="table-container">
          {events.length === 0 ? (
            <div className="panel-body">
              <div className="empty-state compact">
                <span>No security events linked.</span>
              </div>
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Event type</th>
                  <th>User</th>
                  <th>Source IP</th>
                  <th>Process</th>
                  <th>Action</th>
                  <th>Event ID</th>
                </tr>
              </thead>

              <tbody>
                {events.map((event) => (
                  <tr key={event.id}>
                    <td className="mono-muted">
                      {formatDate(event.timestamp)}
                    </td>

                    <td>
                      <span className="badge badge-info">
                        {eventTypeLabel(event.event_type)}
                      </span>
                    </td>

                    <td>{event.source_user ?? "-"}</td>

                    <td className="mono-muted">
                      {event.source_ip ?? "-"}
                    </td>

                    <td className="mono-muted">
                      {event.process ?? "-"}
                    </td>

                    <td className="mono-muted">
                      {event.action ?? "-"}
                    </td>

                    <td className="mono-muted">
                      {formatShortId(event.id)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  );
}
