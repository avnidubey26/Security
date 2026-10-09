"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Eye,
  Filter,
  RefreshCw,
  Search,
  ShieldAlert,
  UserRound,
  XCircle,
} from "lucide-react";

import { api, ApiError } from "@/lib/api";
import type { Incident } from "@/types/api";

type IncidentListResponse =
  | Incident[]
  | {
      items?: Incident[];
      data?: Incident[];
      total?: number;
    };

function normalizeIncidents(response: unknown): Incident[] {
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
    return value.items as Incident[];
  }

  if (Array.isArray(value.data)) {
    return value.data as Incident[];
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

function statusIcon(status: string) {
  switch (status.toUpperCase()) {
    case "OPEN":
      return <AlertTriangle size={13} />;
    case "CONTAINED":
      return <ShieldAlert size={13} />;
    case "RESOLVED":
    case "CLOSED":
      return <CheckCircle2 size={13} />;
    case "FALSE_POSITIVE":
      return <XCircle size={13} />;
    default:
      return <Clock3 size={13} />;
  }
}

export default function IncidentsPage() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [severityFilter, setSeverityFilter] = useState("ALL");

  const loadIncidents = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response =
        await api.get<IncidentListResponse>("/incidents");

      setIncidents(normalizeIncidents(response));
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Unable to load incidents.");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadIncidents();
  }, [loadIncidents]);

  const filteredIncidents = useMemo(() => {
    const query = search.trim().toLowerCase();

    return incidents.filter((incident) => {
      const matchesSearch =
        !query ||
        incident.incident_number.toLowerCase().includes(query) ||
        incident.title.toLowerCase().includes(query) ||
        incident.severity.toLowerCase().includes(query) ||
        incident.status.toLowerCase().includes(query) ||
        incident.assigned_to
          ?.toString()
          .toLowerCase()
          .includes(query) ||
        incident.id.toLowerCase().includes(query);

      const matchesStatus =
        statusFilter === "ALL" ||
        incident.status === statusFilter;

      const matchesSeverity =
        severityFilter === "ALL" ||
        incident.severity.toUpperCase() === severityFilter;

      return matchesSearch && matchesStatus && matchesSeverity;
    });
  }, [incidents, search, statusFilter, severityFilter]);

  const metrics = useMemo(
    () => ({
      total: incidents.length,
      open: incidents.filter(
        (incident) => incident.status === "OPEN",
      ).length,
      contained: incidents.filter(
        (incident) => incident.status === "CONTAINED",
      ).length,
      resolved: incidents.filter(
        (incident) =>
          incident.status === "RESOLVED" ||
          incident.status === "CLOSED",
      ).length,
      highSeverity: incidents.filter(
        (incident) =>
          incident.severity === "HIGH" ||
          incident.severity === "CRITICAL",
      ).length,
    }),
    [incidents],
  );

  return (
    <div className="content">
      <div className="page-header">
        <div>
          <p className="eyebrow">Incident response</p>

          <h1>Incidents</h1>

          <p className="page-description">
            Security incidents derived from investigations,
            alerts, evidence, and findings.
          </p>
        </div>

        <button
          type="button"
          className="button"
          onClick={() => void loadIncidents()}
          disabled={loading}
        >
          <RefreshCw
            size={14}
            className={loading ? "loading-icon" : ""}
          />
          Refresh
        </button>
      </div>

      <section className="metrics-grid">
        <div className="metric-card">
          <div className="metric-label">Total incidents</div>
          <div className="metric-value">{metrics.total}</div>
          <div className="metric-detail">
            Recorded security incidents
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-label">Open</div>
          <div className="metric-value">{metrics.open}</div>
          <div className="metric-detail">
            Requires response activity
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-label">Contained</div>
          <div className="metric-value">{metrics.contained}</div>
          <div className="metric-detail">
            Threat activity contained
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-label">High severity</div>
          <div className="metric-value">{metrics.highSeverity}</div>
          <div className="metric-detail">
            High and critical incidents
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="panel-header">
          <div className="row">
            <ShieldAlert
              size={15}
              color="var(--accent)"
            />

            <span className="panel-title">
              Incident register
            </span>
          </div>

          <span className="mono-muted">
            {filteredIncidents.length} of {incidents.length}
          </span>
        </div>

        <div className="panel-body">
          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "minmax(220px, 1fr) 180px 180px",
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
                placeholder="Search incidents..."
                value={search}
                onChange={(event) =>
                  setSearch(event.target.value)
                }
              />
            </label>

            <label className="select-box">
              <Filter size={13} />

              <select
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(event.target.value)
                }
              >
                <option value="ALL">All statuses</option>
                <option value="OPEN">Open</option>
                <option value="CONTAINED">Contained</option>
                <option value="RESOLVED">Resolved</option>
                <option value="CLOSED">Closed</option>
                <option value="FALSE_POSITIVE">
                  False positive
                </option>
              </select>
            </label>

            <label className="select-box">
              <Filter size={13} />

              <select
                value={severityFilter}
                onChange={(event) =>
                  setSeverityFilter(event.target.value)
                }
              >
                <option value="ALL">All severities</option>
                <option value="CRITICAL">Critical</option>
                <option value="HIGH">High</option>
                <option value="MEDIUM">Medium</option>
                <option value="LOW">Low</option>
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
                  Unable to load incidents
                </strong>
              </div>

              <div style={{ marginTop: 6 }}>{error}</div>

              <button
                type="button"
                className="button button-danger"
                style={{ marginTop: 12 }}
                onClick={() => void loadIncidents()}
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
                Loading incident register...
              </span>
            </div>
          </div>
        ) : filteredIncidents.length === 0 ? (
          <div className="panel-body">
            <div className="empty-state">
              <div>
                <ShieldAlert size={20} />

                <div
                  className="empty-state-title"
                  style={{ marginTop: 10 }}
                >
                  No incidents found
                </div>

                <p className="empty-state-description">
                  {incidents.length === 0
                    ? "No security incidents are currently recorded."
                    : "No incidents match the current filters."}
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Incident</th>
                  <th>Severity</th>
                  <th>Status</th>
                  <th>Assigned to</th>
                  <th>Detected</th>
                  <th>Updated</th>
                  <th />
                </tr>
              </thead>

              <tbody>
                {filteredIncidents.map((incident) => (
                  <tr key={incident.id}>
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
                          <ShieldAlert
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
                            {incident.title}
                          </div>

                          <div
                            className="mono-muted"
                            style={{
                              marginTop: 4,
                            }}
                          >
                            {incident.incident_number}
                          </div>
                        </div>
                      </div>
                    </td>

                    <td>
                      <span
                        className={severityClass(
                          incident.severity,
                        )}
                        style={{
                          fontFamily:
                            "var(--font-mono)",
                          fontSize: 10,
                          fontWeight: 600,
                          textTransform: "uppercase",
                        }}
                      >
                        {incident.severity}
                      </span>
                    </td>

                    <td>
                      <span
                        className={`badge ${statusClass(
                          incident.status,
                        )}`}
                      >
                        {statusIcon(incident.status)}

                        {incident.status.replaceAll(
                          "_",
                          " ",
                        )}
                      </span>
                    </td>

                    <td>
                      <div className="row">
                        <UserRound
                          size={12}
                          color="var(--muted)"
                        />

                        <span className="mono-muted">
                          {incident.assigned_to ??
                            "Unassigned"}
                        </span>
                      </div>
                    </td>

                    <td>
                      <div className="row">
                        <CalendarDays
                          size={12}
                          color="var(--muted)"
                        />

                        <span className="mono-muted">
                          {formatDate(
                            incident.detected_at,
                          )}
                        </span>
                      </div>
                    </td>

                    <td className="mono-muted">
                      {formatDate(incident.updated_at)}
                    </td>

                    <td>
                      <Link
                        href={`/incidents/${incident.id}`}
                        className="icon-button"
                        aria-label={`Open incident ${incident.incident_number}`}
                        title="Open incident"
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
            <CheckCircle2
              size={15}
              color="var(--accent)"
            />

            <span className="panel-title">
              Incident lifecycle
            </span>
          </div>
        </div>

        <div className="panel-body">
          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit, minmax(180px, 1fr))",
              gap: 12,
            }}
          >
            {[
              ["OPEN", "Detection and response"],
              ["CONTAINED", "Threat activity contained"],
              ["RESOLVED", "Response completed"],
              ["CLOSED", "Incident formally closed"],
            ].map(([status, description]) => (
              <div
                key={status}
                className="security-control"
              >
                <CheckCircle2
                  size={15}
                  color="var(--accent)"
                />

                <div>
                  <strong>{status}</strong>

                  <p className="muted">
                    {description}
                  </p>
                </div>
              </div>
            ))}
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
        <Clock3 size={12} />
        Incident records remain traceable to their
        originating investigation.
      </div>
    </div>
  );
}