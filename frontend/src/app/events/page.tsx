"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  Clock3,
  Filter,
  RefreshCw,
  Search,
  Server,
  UserRound,
} from "lucide-react";

import { api, ApiError } from "@/lib/api";
import type { SecurityEvent } from "@/types/api";

type EventListResponse =
  | SecurityEvent[]
  | {
      items?: SecurityEvent[];
      data?: SecurityEvent[];
      total?: number;
    };

function normalizeEvents(response: unknown): SecurityEvent[] {
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
    return value.items as SecurityEvent[];
  }

  if (Array.isArray(value.data)) {
    return value.data as SecurityEvent[];
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
    second: "2-digit",
  }).format(date);
}

function formatTime(value: string | null | undefined): string {
  if (!value) {
    return "-";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(date);
}

function shortId(value: string | null | undefined): string {
  if (!value) {
    return "-";
  }

  return `${value.slice(0, 8)}...`;
}

function eventTypeLabel(value: string): string {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function eventTypeClass(value: string): string {
  switch (value) {
    case "AUTHENTICATION_FAILED":
      return "badge-danger";
    case "AUTHENTICATION_SUCCESS":
      return "badge-success";
    case "PROCESS_EXECUTION":
      return "badge-warning";
    case "NETWORK_CONNECTION":
      return "badge-info";
    default:
      return "badge-info";
  }
}

function statusClass(value: string | null | undefined): string {
  switch (value) {
    case "FAILED":
      return "badge-danger";
    case "SUCCESS":
      return "badge-success";
    case "BLOCKED":
      return "badge-warning";
    default:
      return "badge-info";
  }
}

export default function EventsPage() {
  const [events, setEvents] = useState<SecurityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [eventTypeFilter, setEventTypeFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

  const loadEvents = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response =
        await api.get<EventListResponse>("/events");

      setEvents(normalizeEvents(response));
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Unable to load security events.");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadEvents();
  }, [loadEvents]);

  const eventTypes = useMemo(() => {
    return Array.from(
      new Set(events.map((event) => event.event_type)),
    ).sort();
  }, [events]);

  const statuses = useMemo(() => {
    return Array.from(
      new Set(
        events
          .map((event) => event.status)
          .filter(
            (status): status is string => Boolean(status),
          ),
      ),
    ).sort();
  }, [events]);

  const filteredEvents = useMemo(() => {
    const query = search.trim().toLowerCase();

    return [...events]
      .filter((event) => {
        const searchableFields = [
          event.id,
          event.event_type,
          event.source,
          event.source_user,
          event.source_ip,
          event.destination_ip,
          event.process,
          event.parent_process,
          event.action,
          event.status,
          event.hostname,
          event.resource,
        ];

        const matchesSearch =
          !query ||
          searchableFields.some((value) =>
            value?.toLowerCase().includes(query),
          );

        const matchesType =
          eventTypeFilter === "ALL" ||
          event.event_type === eventTypeFilter;

        const matchesStatus =
          statusFilter === "ALL" ||
          event.status === statusFilter;

        return matchesSearch && matchesType && matchesStatus;
      })
      .sort(
        (a, b) =>
          new Date(b.timestamp).getTime() -
          new Date(a.timestamp).getTime(),
      );
  }, [
    events,
    search,
    eventTypeFilter,
    statusFilter,
  ]);

  const metrics = useMemo(
    () => ({
      total: events.length,
      authentication: events.filter((event) =>
        event.event_type.startsWith("AUTHENTICATION"),
      ).length,
      process: events.filter(
        (event) => event.event_type === "PROCESS_EXECUTION",
      ).length,
      failed: events.filter(
        (event) => event.status === "FAILED",
      ).length,
    }),
    [events],
  );

  const selectedEvent = useMemo(
    () =>
      events.find((event) => event.id === selectedEventId) ??
      null,
    [events, selectedEventId],
  );

  const hasActiveFilters =
    search.trim().length > 0 ||
    eventTypeFilter !== "ALL" ||
    statusFilter !== "ALL";

  const clearFilters = () => {
    setSearch("");
    setEventTypeFilter("ALL");
    setStatusFilter("ALL");
  };

  return (
    <div className="content">
      <div className="page-header">
        <div>
          <p className="eyebrow">Telemetry</p>
          <h1>Security Events</h1>
          <p className="page-description">
            Normalized security telemetry collected and evaluated by
            the platform.
          </p>
        </div>

        <button
          type="button"
          className="button"
          onClick={() => void loadEvents()}
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
          <div className="metric-label">Events ingested</div>
          <div className="metric-value">{metrics.total}</div>
          <div className="metric-detail">
            Normalized security events
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-label">Authentication</div>
          <div className="metric-value">
            {metrics.authentication}
          </div>
          <div className="metric-detail">
            Authentication activity
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-label">Process execution</div>
          <div className="metric-value">{metrics.process}</div>
          <div className="metric-detail">
            Process activity observed
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-label">Failed events</div>
          <div className="metric-value">{metrics.failed}</div>
          <div className="metric-detail">
            Events with failed status
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="panel-header">
          <div className="row">
            <Activity size={15} color="var(--accent)" />
            <span className="panel-title">Event explorer</span>
          </div>

          <span className="mono-muted">
            {filteredEvents.length} of {events.length}
          </span>
        </div>

        <div className="panel-body">
          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "minmax(220px, 1fr) 210px 180px auto",
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
                placeholder="Search IP, user, process, event..."
                value={search}
                onChange={(event) =>
                  setSearch(event.target.value)
                }
              />
            </label>

            <label className="select-box">
              <Filter size={13} />

              <select
                value={eventTypeFilter}
                onChange={(event) =>
                  setEventTypeFilter(event.target.value)
                }
              >
                <option value="ALL">All event types</option>

                {eventTypes.map((eventType) => (
                  <option key={eventType} value={eventType}>
                    {eventTypeLabel(eventType)}
                  </option>
                ))}
              </select>
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

                {statuses.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </label>

            {hasActiveFilters ? (
              <button
                type="button"
                className="button button-secondary"
                onClick={clearFilters}
              >
                Clear
              </button>
            ) : null}
          </div>
        </div>

        {error ? (
          <div className="panel-body">
            <div className="error-state">
              <div className="row">
                <AlertCircle size={15} />
                <strong>Unable to load events</strong>
              </div>

              <div style={{ marginTop: 6 }}>{error}</div>

              <button
                type="button"
                className="button button-danger"
                style={{ marginTop: 12 }}
                onClick={() => void loadEvents()}
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
              <span>Loading security events...</span>
            </div>
          </div>
        ) : filteredEvents.length === 0 ? (
          <div className="panel-body">
            <div className="empty-state">
              <div>
                <Activity size={20} />

                <div
                  className="empty-state-title"
                  style={{ marginTop: 10 }}
                >
                  No events found
                </div>

                <p className="empty-state-description">
                  {events.length === 0
                    ? "No normalized security events are available yet."
                    : "No events match the current filters."}
                </p>

                {hasActiveFilters ? (
                  <button
                    type="button"
                    className="button button-secondary"
                    style={{ marginTop: 12 }}
                    onClick={clearFilters}
                  >
                    Clear filters
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        ) : (
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th></th>
                  <th>Timestamp</th>
                  <th>Event type</th>
                  <th>Status</th>
                  <th>User</th>
                  <th>Source</th>
                  <th>Destination</th>
                  <th>Process</th>
                  <th>Host</th>
                </tr>
              </thead>

              <tbody>
                {filteredEvents.map((event) => {
                  const isSelected =
                    selectedEventId === event.id;

                  return (
                    <>
                      <tr
                        key={event.id}
                        onClick={() =>
                          setSelectedEventId(
                            isSelected ? null : event.id,
                          )
                        }
                        style={{ cursor: "pointer" }}
                      >
                        <td style={{ width: 34 }}>
                          {isSelected ? (
                            <ChevronDown size={14} />
                          ) : (
                            <ChevronRight size={14} />
                          )}
                        </td>

                        <td className="mono-muted">
                          <div>{formatTime(event.timestamp)}</div>
                          <div
                            style={{
                              marginTop: 3,
                              opacity: 0.65,
                            }}
                          >
                            {formatDate(event.timestamp).split(",")[0]}
                          </div>
                        </td>

                        <td>
                          <span
                            className={`badge ${eventTypeClass(
                              event.event_type,
                            )}`}
                          >
                            {eventTypeLabel(event.event_type)}
                          </span>
                        </td>

                        <td>
                          {event.status ? (
                            <span
                              className={`badge ${statusClass(
                                event.status,
                              )}`}
                            >
                              {event.status}
                            </span>
                          ) : (
                            "-"
                          )}
                        </td>

                        <td>
                          <div className="row">
                            <UserRound
                              size={12}
                              color="var(--muted)"
                            />
                            {event.source_user ?? "-"}
                          </div>
                        </td>

                        <td className="mono-muted">
                          {event.source_ip ?? "-"}
                        </td>

                        <td className="mono-muted">
                          {event.destination_ip
                            ? `${event.destination_ip}${
                                event.destination_port
                                  ? `:${event.destination_port}`
                                  : ""
                              }`
                            : "-"}
                        </td>

                        <td>
                          {event.process ? (
                            <div>
                              <div className="mono-muted">
                                {event.process}
                              </div>

                              {event.parent_process ? (
                                <div
                                  className="mono-muted"
                                  style={{
                                    marginTop: 3,
                                    opacity: 0.7,
                                  }}
                                >
                                  parent: {event.parent_process}
                                </div>
                              ) : null}
                            </div>
                          ) : (
                            "-"
                          )}
                        </td>

                        <td>
                          {event.hostname ? (
                            <div className="row">
                              <Server
                                size={12}
                                color="var(--muted)"
                              />
                              <span className="mono-muted">
                                {event.hostname}
                              </span>
                            </div>
                          ) : (
                            "-"
                          )}
                        </td>
                      </tr>

                      {isSelected ? (
                        <tr key={`${event.id}-detail`}>
                          <td colSpan={9}>
                            <div
                              style={{
                                padding: "16px 18px",
                                display: "grid",
                                gridTemplateColumns:
                                  "minmax(220px, 1.3fr) minmax(180px, 1fr) minmax(180px, 1fr)",
                                gap: 18,
                                background:
                                  "var(--console-surface, var(--surface))",
                              }}
                            >
                              <div>
                                <div className="metric-label">
                                  Event identity
                                </div>

                                <div
                                  className="mono-muted"
                                  style={{ marginTop: 7 }}
                                >
                                  {event.id}
                                </div>

                                <div
                                  className="mono-muted"
                                  style={{ marginTop: 5 }}
                                >
                                  Timestamp:{" "}
                                  {formatDate(event.timestamp)}
                                </div>
                              </div>

                              <div>
                                <div className="metric-label">
                                  Activity
                                </div>

                                <div
                                  className="mono-muted"
                                  style={{
                                    marginTop: 7,
                                    lineHeight: 1.7,
                                  }}
                                >
                                  <div>
                                    Action: {event.action ?? "-"}
                                  </div>
                                  <div>
                                    Resource:{" "}
                                    {event.resource ?? "-"}
                                  </div>
                                  <div>
                                    Source:{" "}
                                    {event.source ?? "-"}
                                  </div>
                                </div>
                              </div>

                              <div>
                                <div className="metric-label">
                                  Process context
                                </div>

                                <div
                                  className="mono-muted"
                                  style={{
                                    marginTop: 7,
                                    lineHeight: 1.7,
                                  }}
                                >
                                  <div>
                                    Process:{" "}
                                    {event.process ?? "-"}
                                  </div>
                                  <div>
                                    Parent:{" "}
                                    {event.parent_process ?? "-"}
                                  </div>
                                  <div>
                                    Host:{" "}
                                    {event.hostname ?? "-"}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      ) : null}
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {selectedEvent ? (
        <div
          className="mono-muted"
          style={{
            marginTop: 10,
            fontSize: 11,
            display: "flex",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <span>
            Selected event: {shortId(selectedEvent.id)}
          </span>

          <span>
            Click the row again to collapse event context.
          </span>
        </div>
      ) : null}
    </div>
  );
}