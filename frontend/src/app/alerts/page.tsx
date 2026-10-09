"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  Clock3,
  Eye,
  Filter,
  RefreshCw,
  Search,
  ShieldAlert,
  XCircle,
} from "lucide-react";

import { api, ApiError } from "@/lib/api";
import type { Alert } from "@/types/api";

type AlertListResponse =
  | Alert[]
  | {
      items?: Alert[];
      data?: Alert[];
      total?: number;
    };

type AlertStatus =
  | "NEW"
  | "ACKNOWLEDGED"
  | "RESOLVED"
  | "DISMISSED";

function normalizeAlerts(response: unknown): Alert[] {
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
    return value.items as Alert[];
  }

  if (Array.isArray(value.data)) {
    return value.data as Alert[];
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

function shortId(value: string | null | undefined): string {
  if (!value) {
    return "-";
  }

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

function statusClass(status: AlertStatus): string {
  switch (status) {
    case "NEW":
      return "badge-danger";
    case "ACKNOWLEDGED":
      return "badge-warning";
    case "RESOLVED":
      return "badge-success";
    case "DISMISSED":
      return "badge-info";
    default:
      return "";
  }
}

function statusIcon(status: AlertStatus) {
  switch (status) {
    case "NEW":
      return <AlertTriangle size={13} />;
    case "ACKNOWLEDGED":
      return <Eye size={13} />;
    case "RESOLVED":
      return <CheckCircle2 size={13} />;
    case "DISMISSED":
      return <XCircle size={13} />;
    default:
      return <Bell size={13} />;
  }
}

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | AlertStatus>(
    "ALL",
  );
  const [severityFilter, setSeverityFilter] = useState<
    "ALL" | "CRITICAL" | "HIGH" | "MEDIUM" | "LOW"
  >("ALL");

  const loadAlerts = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response =
        await api.get<AlertListResponse>("/alerts");

      setAlerts(normalizeAlerts(response));
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Unable to load alerts.");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAlerts();
  }, [loadAlerts]);

  const filteredAlerts = useMemo(() => {
    const query = search.trim().toLowerCase();

    return alerts.filter((alert) => {
      const matchesSearch =
        !query ||
        alert.title.toLowerCase().includes(query) ||
        alert.severity.toLowerCase().includes(query) ||
        alert.status.toLowerCase().includes(query) ||
        alert.id.toLowerCase().includes(query) ||
        alert.detection_rule_version_id
          .toLowerCase()
          .includes(query);

      const matchesStatus =
        statusFilter === "ALL" || alert.status === statusFilter;

      const matchesSeverity =
        severityFilter === "ALL" ||
        alert.severity.toUpperCase() === severityFilter;

      return (
        matchesSearch &&
        matchesStatus &&
        matchesSeverity
      );
    });
  }, [alerts, search, statusFilter, severityFilter]);

  const metrics = useMemo(
    () => ({
      total: alerts.length,
      new: alerts.filter((alert) => alert.status === "NEW").length,
      acknowledged: alerts.filter(
        (alert) => alert.status === "ACKNOWLEDGED",
      ).length,
      resolved: alerts.filter(
        (alert) => alert.status === "RESOLVED",
      ).length,
      highPriority: alerts.filter(
        (alert) =>
          alert.severity === "HIGH" ||
          alert.severity === "CRITICAL",
      ).length,
    }),
    [alerts],
  );

  return (
    <div className="content">
      <div className="page-header">
        <div>
          <p className="eyebrow">Security operations</p>
          <h1>Alerts</h1>
          <p className="page-description">
            Detection signals generated by the security engine.
          </p>
        </div>

        <button
          type="button"
          className="button"
          onClick={() => void loadAlerts()}
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
          <div className="metric-label">Total alerts</div>
          <div className="metric-value">{metrics.total}</div>
          <div className="metric-detail">
            All generated detections
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-label">New</div>
          <div className="metric-value">{metrics.new}</div>
          <div className="metric-detail">Requires triage</div>
        </div>

        <div className="metric-card">
          <div className="metric-label">Acknowledged</div>
          <div className="metric-value">
            {metrics.acknowledged}
          </div>
          <div className="metric-detail">Under investigation</div>
        </div>

        <div className="metric-card">
          <div className="metric-label">High priority</div>
          <div className="metric-value">
            {metrics.highPriority}
          </div>
          <div className="metric-detail">
            High and critical severity
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="panel-header">
          <div className="row">
            <ShieldAlert size={15} color="var(--accent)" />
            <span className="panel-title">Alert queue</span>
          </div>

          <span className="mono-muted">
            {filteredAlerts.length} of {alerts.length}
          </span>
        </div>

        <div className="panel-body">
          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "minmax(220px, 1fr) 180px 180px auto",
              gap: 10,
              alignItems: "center",
            }}
          >
            <label
              className="search-box"
              style={{ width: "100%" }}
            >
              <Search size={14} />
              <input
                type="search"
                placeholder="Search alerts..."
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
                  setStatusFilter(
                    event.target.value as "ALL" | AlertStatus,
                  )
                }
              >
                <option value="ALL">All statuses</option>
                <option value="NEW">New</option>
                <option value="ACKNOWLEDGED">
                  Acknowledged
                </option>
                <option value="RESOLVED">Resolved</option>
                <option value="DISMISSED">Dismissed</option>
              </select>
            </label>

            <label className="select-box">
              <ShieldAlert size={13} />

              <select
                value={severityFilter}
                onChange={(event) =>
                  setSeverityFilter(
                    event.target.value as
                      | "ALL"
                      | "CRITICAL"
                      | "HIGH"
                      | "MEDIUM"
                      | "LOW",
                  )
                }
              >
                <option value="ALL">All severities</option>
                <option value="CRITICAL">Critical</option>
                <option value="HIGH">High</option>
                <option value="MEDIUM">Medium</option>
                <option value="LOW">Low</option>
              </select>
            </label>

            <div className="mono-muted">
              {metrics.resolved} resolved
            </div>
          </div>
        </div>

        {error ? (
          <div className="panel-body">
            <div className="error-state">
              <div className="row">
                <AlertTriangle size={15} />
                <strong>Unable to load alerts</strong>
              </div>

              <div style={{ marginTop: 6 }}>{error}</div>

              <button
                type="button"
                className="button button-danger"
                style={{ marginTop: 12 }}
                onClick={() => void loadAlerts()}
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
              <span>Loading alert queue...</span>
            </div>
          </div>
        ) : filteredAlerts.length === 0 ? (
          <div className="panel-body">
            <div className="empty-state">
              <div>
                <Bell size={20} />

                <div
                  className="empty-state-title"
                  style={{ marginTop: 10 }}
                >
                  No alerts found
                </div>

                <p className="empty-state-description">
                  {alerts.length === 0
                    ? "The detection engine has not generated any alerts yet."
                    : "No alerts match the current filters."}
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Alert</th>
                  <th>Severity</th>
                  <th>Confidence</th>
                  <th>Status</th>
                  <th>Detection version</th>
                  <th>Created</th>
                  <th />
                </tr>
              </thead>

              <tbody>
                {filteredAlerts.map((alert) => (
                  <tr key={alert.id}>
                    <td>
                      <div className="row" style={{ gap: 9 }}>
                        <div
                          style={{
                            width: 28,
                            height: 28,
                            borderRadius: 6,
                            display: "grid",
                            placeItems: "center",
                            border:
                              "1px solid var(--border)",
                            background:
                              "var(--surface-raised)",
                          }}
                        >
                          <AlertTriangle
                            size={14}
                            color="var(--accent)"
                          />
                        </div>

                        <div>
                          <div style={{ fontWeight: 600 }}>
                            {alert.title}
                          </div>

                          <div
                            className="mono-muted"
                            style={{ marginTop: 4 }}
                          >
                            {shortId(alert.id)}
                          </div>
                        </div>
                      </div>
                    </td>

                    <td>
                      <span
                        className={severityClass(
                          alert.severity,
                        )}
                        style={{
                          fontFamily: "var(--font-mono)",
                          fontSize: 10,
                          fontWeight: 600,
                          textTransform: "uppercase",
                        }}
                      >
                        {alert.severity}
                      </span>
                    </td>

                    <td>
                      <div
                        style={{
                          minWidth: 80,
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                        }}
                      >
                        <div
                          style={{
                            height: 5,
                            flex: 1,
                            borderRadius: 999,
                            background: "var(--border)",
                            overflow: "hidden",
                          }}
                        >
                          <div
                            style={{
                              width: `${Math.min(
                                Math.max(alert.confidence, 0),
                                100,
                              )}%`,
                              height: "100%",
                              background:
                                "var(--accent)",
                            }}
                          />
                        </div>

                        <span className="mono-muted">
                          {alert.confidence}%
                        </span>
                      </div>
                    </td>

                    <td>
                      <span
                        className={`badge ${statusClass(
                          alert.status as AlertStatus,
                        )}`}
                      >
                        {statusIcon(
                          alert.status as AlertStatus,
                        )}
                        {alert.status.replaceAll("_", " ")}
                      </span>
                    </td>

                    <td className="mono-muted">
                      {shortId(
                        alert.detection_rule_version_id,
                      )}
                    </td>

                    <td className="mono-muted">
                      {formatDate(alert.created_at)}
                    </td>

                    <td>
                      <Link
                        href={`/alerts/${alert.id}`}
                        className="icon-button"
                        aria-label={`Open alert ${alert.id}`}
                        title="Open alert"
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
    </div>
  );
}