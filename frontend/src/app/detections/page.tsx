"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock3,
  Code2,
  Eye,
  Filter,
  RefreshCw,
  Search,
  ShieldCheck,
  ToggleLeft,
  ToggleRight,
} from "lucide-react";

import { api, ApiError } from "@/lib/api";
import type { DetectionRule } from "@/types/api";

type DetectionListResponse =
  | DetectionRule[]
  | {
      items?: DetectionRule[];
      data?: DetectionRule[];
      total?: number;
    };

function normalizeRules(response: unknown): DetectionRule[] {
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
    return value.items as DetectionRule[];
  }

  if (Array.isArray(value.data)) {
    return value.data as DetectionRule[];
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

function statusClass(status: string): string {
  switch (status.toUpperCase()) {
    case "ACTIVE":
      return "badge-success";
    case "DISABLED":
      return "badge-info";
    case "DRAFT":
      return "badge-warning";
    case "ARCHIVED":
      return "badge-info";
    default:
      return "";
  }
}

export default function DetectionsPage() {
  const [rules, setRules] = useState<DetectionRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [selectedRuleId, setSelectedRuleId] = useState<string | null>(
    null,
  );

  const loadRules = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response =
        await api.get<DetectionListResponse>("/detection-rules");

      setRules(normalizeRules(response));
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Unable to load detection rules.");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadRules();
  }, [loadRules]);

  const filteredRules = useMemo(() => {
    const query = search.trim().toLowerCase();

    return [...rules].filter((rule) => {
      const matchesSearch =
        !query ||
        rule.name.toLowerCase().includes(query) ||
        rule.slug.toLowerCase().includes(query) ||
        rule.status.toLowerCase().includes(query) ||
        rule.description?.toLowerCase().includes(query);

      const matchesStatus =
        statusFilter === "ALL" ||
        rule.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [rules, search, statusFilter]);

  const metrics = useMemo(
    () => ({
      total: rules.length,
      active: rules.filter(
        (rule) => rule.status === "ACTIVE",
      ).length,
      disabled: rules.filter(
        (rule) => rule.status === "DISABLED",
      ).length,
      draft: rules.filter(
        (rule) => rule.status === "DRAFT",
      ).length,
    }),
    [rules],
  );

  const selectedRule = useMemo(
    () =>
      rules.find((rule) => rule.id === selectedRuleId) ??
      null,
    [rules, selectedRuleId],
  );

  const clearFilters = () => {
    setSearch("");
    setStatusFilter("ALL");
  };

  const hasActiveFilters =
    search.trim().length > 0 || statusFilter !== "ALL";

  return (
    <div className="content">
      <div className="page-header">
        <div>
          <p className="eyebrow">Detection engineering</p>

          <h1>Detection Rules</h1>

          <p className="page-description">
            Versioned rules used to evaluate normalized security
            events and generate explainable detection results.
          </p>
        </div>

        <button
          type="button"
          className="button"
          onClick={() => void loadRules()}
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
          <div className="metric-label">Detection rules</div>

          <div className="metric-value">{metrics.total}</div>

          <div className="metric-detail">
            Registered detection logic
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-label">Active rules</div>

          <div className="metric-value">{metrics.active}</div>

          <div className="metric-detail">
            Currently evaluating
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-label">Disabled rules</div>

          <div className="metric-value">{metrics.disabled}</div>

          <div className="metric-detail">
            Not currently evaluating
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-label">Draft rules</div>

          <div className="metric-value">{metrics.draft}</div>

          <div className="metric-detail">
            Rules under development
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="panel-header">
          <div className="row">
            <ShieldCheck
              size={15}
              color="var(--accent)"
            />

            <span className="panel-title">
              Detection registry
            </span>
          </div>

          <span className="mono-muted">
            {filteredRules.length} of {rules.length}
          </span>
        </div>

        <div className="panel-body">
          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "minmax(220px, 1fr) 180px auto",
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
                placeholder="Search rule name, slug, description..."
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
                <option value="ACTIVE">Active</option>
                <option value="DISABLED">Disabled</option>
                <option value="DRAFT">Draft</option>
                <option value="ARCHIVED">Archived</option>
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

                <strong>
                  Unable to load detection rules
                </strong>
              </div>

              <div style={{ marginTop: 6 }}>
                {error}
              </div>

              <button
                type="button"
                className="button button-danger"
                style={{ marginTop: 12 }}
                onClick={() => void loadRules()}
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
                Loading detection registry...
              </span>
            </div>
          </div>
        ) : filteredRules.length === 0 ? (
          <div className="panel-body">
            <div className="empty-state">
              <div>
                <ShieldCheck size={20} />

                <div
                  className="empty-state-title"
                  style={{ marginTop: 10 }}
                >
                  No detection rules found
                </div>

                <p className="empty-state-description">
                  {rules.length === 0
                    ? "No detection rules are currently registered."
                    : "No rules match the current filters."}
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
                  <th>Detection rule</th>
                  <th>Status</th>
                  <th>Slug</th>
                  <th>Rule ID</th>
                  <th>Created</th>
                  <th>Updated</th>
                  <th />
                </tr>
              </thead>

              <tbody>
                {filteredRules.map((rule) => {
                  const isSelected =
                    selectedRuleId === rule.id;

                  return (
                    <>
                      <tr
                        key={rule.id}
                        onClick={() =>
                          setSelectedRuleId(
                            isSelected ? null : rule.id,
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
                              <Code2
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
                                {rule.name}
                              </div>

                              {rule.description ? (
                                <div
                                  className="mono-muted"
                                  style={{
                                    marginTop: 4,
                                    maxWidth: 360,
                                    overflow: "hidden",
                                    textOverflow:
                                      "ellipsis",
                                    whiteSpace:
                                      "nowrap",
                                  }}
                                >
                                  {rule.description}
                                </div>
                              ) : null}
                            </div>
                          </div>
                        </td>

                        <td>
                          <span
                            className={`badge ${statusClass(
                              rule.status,
                            )}`}
                          >
                            {rule.status === "ACTIVE" ? (
                              <ToggleRight size={13} />
                            ) : (
                              <ToggleLeft size={13} />
                            )}

                            {rule.status}
                          </span>
                        </td>

                        <td className="mono-muted">
                          {rule.slug}
                        </td>

                        <td className="mono-muted">
                          {shortId(rule.id)}
                        </td>

                        <td className="mono-muted">
                          {formatDate(rule.created_at)}
                        </td>

                        <td className="mono-muted">
                          {formatDate(rule.updated_at)}
                        </td>

                        <td>
                          <button
                            type="button"
                            className="icon-button"
                            aria-label={`Inspect detection rule ${rule.name}`}
                            title="Inspect detection rule"
                            onClick={(event) => {
                              event.stopPropagation();
                              setSelectedRuleId(
                                isSelected ? null : rule.id,
                              );
                            }}
                          >
                            <Eye size={14} />
                          </button>
                        </td>
                      </tr>

                      {isSelected ? (
                        <tr key={`${rule.id}-detail`}>
                          <td colSpan={8}>
                            <div
                              style={{
                                padding: "18px",
                                display: "grid",
                                gridTemplateColumns:
                                  "minmax(280px, 1.5fr) repeat(2, minmax(180px, 1fr))",
                                gap: 18,
                                background:
                                  "var(--console-surface, var(--surface))",
                              }}
                            >
                              <div>
                                <div className="metric-label">
                                  Detection identity
                                </div>

                                <div
                                  style={{
                                    marginTop: 7,
                                    fontWeight: 600,
                                  }}
                                >
                                  {rule.name}
                                </div>

                                <div
                                  className="mono-muted"
                                  style={{
                                    marginTop: 5,
                                  }}
                                >
                                  {rule.slug}
                                </div>

                                {rule.description ? (
                                  <p
                                    className="muted"
                                    style={{
                                      marginTop: 8,
                                      lineHeight: 1.6,
                                    }}
                                  >
                                    {rule.description}
                                  </p>
                                ) : null}
                              </div>

                              <div>
                                <div className="metric-label">
                                  Status
                                </div>

                                <div
                                  style={{
                                    marginTop: 8,
                                  }}
                                >
                                  <span
                                    className={`badge ${statusClass(
                                      rule.status,
                                    )}`}
                                  >
                                    {rule.status ===
                                    "ACTIVE" ? (
                                      <ToggleRight
                                        size={13}
                                      />
                                    ) : (
                                      <ToggleLeft
                                        size={13}
                                      />
                                    )}

                                    {rule.status}
                                  </span>
                                </div>
                              </div>

                              <div>
                                <div className="metric-label">
                                  Rule identity
                                </div>

                                <div
                                  className="mono-muted"
                                  style={{
                                    marginTop: 8,
                                  }}
                                >
                                  {rule.id}
                                </div>

                                <div
                                  className="mono-muted"
                                  style={{
                                    marginTop: 5,
                                    opacity: 0.7,
                                  }}
                                >
                                  Updated{" "}
                                  {formatDate(
                                    rule.updated_at,
                                  )}
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

      <section
        className="panel"
        style={{ marginTop: 16 }}
      >
        <div className="panel-header">
          <div className="row">
            <Activity
              size={15}
              color="var(--accent)"
            />

            <span className="panel-title">
              Detection engineering controls
            </span>
          </div>
        </div>

        <div className="panel-body">
          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit, minmax(210px, 1fr))",
              gap: 12,
            }}
          >
            <div className="security-control">
              <CheckCircle2
                size={15}
                color="var(--accent)"
              />

              <div>
                <strong>Versioned rules</strong>

                <p className="muted">
                  Detection logic is maintained through
                  explicit rule versions in the backend.
                </p>
              </div>
            </div>

            <div className="security-control">
              <ShieldCheck
                size={15}
                color="var(--accent)"
              />

              <div>
                <strong>Controlled activation</strong>

                <p className="muted">
                  Only active detection rules participate in
                  the operational detection workflow.
                </p>
              </div>
            </div>

            <div className="security-control">
              <Code2
                size={15}
                color="var(--accent)"
              />

              <div>
                <strong>Structured detection logic</strong>

                <p className="muted">
                  Detection definitions remain separate from
                  application presentation.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}