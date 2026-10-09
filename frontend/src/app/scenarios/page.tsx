"use client";

import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  Activity,
  AlertCircle,
  CheckCircle2,
  Clock3,
  FlaskConical,
  Play,
  RefreshCw,
  Search,
  Server,
  ShieldCheck,
  Terminal,
  XCircle,
} from "lucide-react";

import { api, ApiError } from "@/lib/api";
import type { Scenario, ScenarioRun } from "@/types/api";

type ScenarioListResponse =
  | Scenario[]
  | {
      items?: Scenario[];
      data?: Scenario[];
      total?: number;
    };

type RunListResponse =
  | ScenarioRun[]
  | {
      items?: ScenarioRun[];
      data?: ScenarioRun[];
      total?: number;
    };

type RunParameters = Record<string, unknown>;

function normalizeScenarios(response: unknown): Scenario[] {
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
    return value.items as Scenario[];
  }

  if (Array.isArray(value.data)) {
    return value.data as Scenario[];
  }

  return [];
}

function normalizeRuns(response: unknown): ScenarioRun[] {
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
    return value.items as ScenarioRun[];
  }

  if (Array.isArray(value.data)) {
    return value.data as ScenarioRun[];
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
    case "COMPLETED":
      return "badge-success";
    case "RUNNING":
      return "badge-warning";
    case "FAILED":
      return "badge-danger";
    case "PENDING":
      return "badge-info";
    default:
      return "badge-info";
  }
}

function scenarioTypeLabel(
  value: string | null | undefined,
): string {
  if (!value) {
    return "Synthetic";
  }

  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) =>
      character.toUpperCase(),
    );
}

function schemaKeys(
  schema: Record<string, unknown> | null | undefined,
): string[] {
  if (!schema || typeof schema !== "object") {
    return [];
  }

  const properties = schema.properties;

  if (
    properties &&
    typeof properties === "object" &&
    !Array.isArray(properties)
  ) {
    return Object.keys(properties);
  }

  return Object.keys(schema);
}

export default function ScenariosPage() {
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [runs, setRuns] = useState<ScenarioRun[]>([]);

  const [loading, setLoading] = useState(true);
  const [runsLoading, setRunsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [selectedScenario, setSelectedScenario] =
    useState<Scenario | null>(null);

  const [parameters, setParameters] =
    useState<RunParameters>({});

  const [running, setRunning] = useState(false);
  const [runMessage, setRunMessage] =
    useState<string | null>(null);

  const loadScenarios = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response =
        await api.get<ScenarioListResponse>("/scenarios");

      setScenarios(normalizeScenarios(response));
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Unable to load security scenarios.");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const loadRuns = useCallback(async () => {
    setRunsLoading(true);

    try {
      const response =
        await api.get<RunListResponse>("/scenarios/runs");

      setRuns(normalizeRuns(response));
    } catch {
      setRuns([]);
    } finally {
      setRunsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadScenarios();
    void loadRuns();
  }, [loadScenarios, loadRuns]);

  const filteredScenarios = useMemo(() => {
    const query = search.trim().toLowerCase();

    return scenarios.filter((scenario) => {
      if (!query) {
        return true;
      }

      return (
        scenario.name.toLowerCase().includes(query) ||
        scenario.slug.toLowerCase().includes(query) ||
        scenario.scenario_type
          ?.toLowerCase()
          .includes(query) ||
        scenario.runner_key
          ?.toLowerCase()
          .includes(query)
      );
    });
  }, [scenarios, search]);

  const metrics = useMemo(
    () => ({
      total: scenarios.length,

      active: scenarios.filter(
        (scenario) => scenario.is_active,
      ).length,

      completed: runs.filter(
        (run) => run.status === "COMPLETED",
      ).length,

      failed: runs.filter(
        (run) => run.status === "FAILED",
      ).length,
    }),
    [scenarios, runs],
  );

  const selectedParameterKeys = useMemo(
    () =>
      selectedScenario
        ? schemaKeys(
            selectedScenario.parameter_schema,
          )
        : [],
    [selectedScenario],
  );

  function openScenario(scenario: Scenario) {
    setSelectedScenario(scenario);
    setRunMessage(null);

    const nextParameters: RunParameters = {};

    for (const key of schemaKeys(
      scenario.parameter_schema,
    )) {
      nextParameters[key] = "";
    }

    setParameters(nextParameters);
  }

  function closeRunner() {
    if (running) {
      return;
    }

    setSelectedScenario(null);
    setRunMessage(null);
    setParameters({});
  }

  function updateParameter(
    key: string,
    value: string,
  ) {
    setParameters((current) => ({
      ...current,
      [key]: value,
    }));
  }

  async function handleRun(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (!selectedScenario) {
      return;
    }

    setRunning(true);
    setRunMessage(null);

    try {
      const response = await api.post<ScenarioRun>(
        `/scenarios/${selectedScenario.id}/runs`,
        {
          parameters,
        },
      );

      setRunMessage(
        `Run ${shortId(response.id)} created with status ${response.status}.`,
      );

      await loadRuns();
    } catch (err) {
      if (err instanceof ApiError) {
        setRunMessage(err.message);
      } else {
        setRunMessage(
          "Unable to start the scenario run.",
        );
      }
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="content">
      <div className="page-header">
        <div>
          <p className="eyebrow">
            Controlled security lab
          </p>

          <h1>Security Scenarios</h1>

          <p className="page-description">
            Generate bounded security telemetry for detection
            and investigation workflows.
          </p>
        </div>

        <button
          type="button"
          className="button"
          onClick={() => {
            void loadScenarios();
            void loadRuns();
          }}
          disabled={loading || runsLoading}
        >
          <RefreshCw
            size={14}
            className={
              loading || runsLoading
                ? "loading-icon"
                : ""
            }
          />
          Refresh
        </button>
      </div>

      <section className="metrics-grid">
        <div className="metric-card">
          <div className="metric-label">
            Scenarios
          </div>

          <div className="metric-value">
            {metrics.total}
          </div>

          <div className="metric-detail">
            Registered lab scenarios
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-label">
            Active
          </div>

          <div className="metric-value">
            {metrics.active}
          </div>

          <div className="metric-detail">
            Available for controlled execution
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-label">
            Completed runs
          </div>

          <div className="metric-value">
            {metrics.completed}
          </div>

          <div className="metric-detail">
            Successful simulations
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-label">
            Failed runs
          </div>

          <div className="metric-value">
            {metrics.failed}
          </div>

          <div className="metric-detail">
            Runner failures
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="panel-header">
          <div className="row">
            <FlaskConical
              size={15}
              color="var(--accent)"
            />

            <span className="panel-title">
              Scenario registry
            </span>
          </div>

          <span className="mono-muted">
            {filteredScenarios.length} of{" "}
            {scenarios.length}
          </span>
        </div>

        <div className="panel-body">
          <label
            className="search-box"
            style={{ width: "100%" }}
          >
            <Search size={14} />

            <input
              type="search"
              placeholder="Search scenario, runner, or type..."
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
            />
          </label>
        </div>

        {error ? (
          <div className="panel-body">
            <div className="error-state">
              <div className="row">
                <AlertCircle size={15} />

                <strong>
                  Unable to load security scenarios
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
                  void loadScenarios()
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
                Loading security scenarios...
              </span>
            </div>
          </div>
        ) : filteredScenarios.length === 0 ? (
          <div className="panel-body">
            <div className="empty-state">
              <div>
                <FlaskConical size={20} />

                <div
                  className="empty-state-title"
                  style={{ marginTop: 10 }}
                >
                  No scenarios found
                </div>

                <p className="empty-state-description">
                  {scenarios.length === 0
                    ? "No controlled security scenarios are registered."
                    : "No scenarios match the current search."}
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Scenario</th>
                  <th>Type</th>
                  <th>Execution</th>
                  <th>Runner</th>
                  <th>Platforms</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>

              <tbody>
                {filteredScenarios.map((scenario) => (
                  <tr key={scenario.id}>
                    <td>
                      <div
                        style={{
                          fontWeight: 600,
                        }}
                      >
                        {scenario.name}
                      </div>

                      <div
                        className="mono-muted"
                        style={{ marginTop: 4 }}
                      >
                        {scenario.slug}
                      </div>
                    </td>

                    <td>
                      <span className="badge badge-info">
                        {scenarioTypeLabel(
                          scenario.scenario_type,
                        )}
                      </span>
                    </td>

                    <td className="mono-muted">
                      {scenario.execution_mode ?? "-"}
                    </td>

                    <td>
                      <div className="row">
                        <Terminal
                          size={12}
                          color="var(--muted)"
                        />

                        <span className="mono-muted">
                          {scenario.runner_key ?? "-"}
                        </span>
                      </div>
                    </td>

                    <td>
                      <div
                        className="row"
                        style={{
                          flexWrap: "wrap",
                          gap: 5,
                        }}
                      >
                        {scenario.allowed_platforms
                          ?.length
                          ? scenario.allowed_platforms.map(
                              (platform) => (
                                <span
                                  className="badge badge-info"
                                  key={platform}
                                >
                                  {platform}
                                </span>
                              ),
                            )
                          : "-"}
                      </div>
                    </td>

                    <td>
                      <span
                        className={`badge ${
                          scenario.is_active
                            ? "badge-success"
                            : "badge-info"
                        }`}
                      >
                        {scenario.is_active ? (
                          <CheckCircle2 size={13} />
                        ) : (
                          <XCircle size={13} />
                        )}

                        {scenario.is_active
                          ? "ACTIVE"
                          : "INACTIVE"}
                      </span>
                    </td>

                    <td>
                      <button
                        type="button"
                        className="button button-small"
                        disabled={!scenario.is_active}
                        onClick={() =>
                          openScenario(scenario)
                        }
                      >
                        <Play size={13} />
                        Run
                      </button>
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
            <Activity
              size={15}
              color="var(--accent)"
            />

            <span className="panel-title">
              Recent scenario runs
            </span>
          </div>

          <span className="mono-muted">
            {runs.length} runs
          </span>
        </div>

        {runs.length === 0 ? (
          <div className="panel-body">
            <div className="empty-state compact">
              <Activity size={17} />

              <span>
                No scenario runs recorded yet.
              </span>
            </div>
          </div>
        ) : (
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Run ID</th>
                  <th>Scenario</th>
                  <th>Status</th>
                  <th>Started</th>
                  <th>Completed</th>
                  <th>Error</th>
                </tr>
              </thead>

              <tbody>
                {runs.slice(0, 10).map((run) => {
                  const scenario = scenarios.find(
                    (item) =>
                      item.id === run.scenario_id,
                  );

                  return (
                    <tr key={run.id}>
                      <td className="mono-muted">
                        {shortId(run.id)}
                      </td>

                      <td>
                        {scenario?.name ??
                          shortId(run.scenario_id)}
                      </td>

                      <td>
                        <span
                          className={`badge ${statusClass(
                            run.status,
                          )}`}
                        >
                          {run.status ===
                          "COMPLETED" ? (
                            <CheckCircle2 size={13} />
                          ) : run.status ===
                            "FAILED" ? (
                            <XCircle size={13} />
                          ) : (
                            <Clock3 size={13} />
                          )}

                          {run.status}
                        </span>
                      </td>

                      <td className="mono-muted">
                        {formatDate(run.started_at)}
                      </td>

                      <td className="mono-muted">
                        {formatDate(
                          run.completed_at,
                        )}
                      </td>

                      <td>
                        {run.error_message ? (
                          <span
                            className="mono-muted"
                            title={run.error_message}
                            style={{
                              display: "block",
                              maxWidth: 260,
                              overflow: "hidden",
                              textOverflow:
                                "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {run.error_message}
                          </span>
                        ) : (
                          "-"
                        )}
                      </td>
                    </tr>
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
            <ShieldCheck
              size={15}
              color="var(--accent)"
            />

            <span className="panel-title">
              Lab safety boundary
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
              <ShieldCheck
                size={15}
                color="var(--accent)"
              />

              <div>
                <strong>Bounded runners</strong>

                <p className="muted">
                  Scenario execution is selected through
                  predefined runner keys rather than
                  arbitrary commands.
                </p>
              </div>
            </div>

            <div className="security-control">
              <Server
                size={15}
                color="var(--accent)"
              />

              <div>
                <strong>Controlled telemetry</strong>

                <p className="muted">
                  Scenarios generate telemetry for defensive
                  detection and investigation workflows.
                </p>
              </div>
            </div>

            <div className="security-control">
              <FlaskConical
                size={15}
                color="var(--accent)"
              />

              <div>
                <strong>Parameter validation</strong>

                <p className="muted">
                  Parameters are supplied through the
                  registered scenario contract.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {selectedScenario ? (
        <div
          role="presentation"
          onMouseDown={(event) => {
            if (
              event.target === event.currentTarget
            ) {
              closeRunner();
            }
          }}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 100,
            display: "grid",
            placeItems: "center",
            padding: 20,
            background: "rgba(0, 0, 0, 0.62)",
          }}
        >
          <div
            className="panel"
            style={{
              width: "min(620px, 100%)",
              maxHeight:
                "calc(100vh - 40px)",
              overflow: "auto",
              boxShadow:
                "0 20px 60px rgba(0, 0, 0, 0.35)",
            }}
          >
            <div className="panel-header">
              <div>
                <div className="eyebrow">
                  Controlled execution
                </div>

                <div
                  className="panel-title"
                  style={{ marginTop: 4 }}
                >
                  {selectedScenario.name}
                </div>
              </div>

              <button
                type="button"
                className="icon-button"
                onClick={closeRunner}
                disabled={running}
                aria-label="Close scenario runner"
              >
                <XCircle size={15} />
              </button>
            </div>

            <div className="panel-body">
              <div
                className="mono-muted"
                style={{
                  marginBottom: 16,
                }}
              >
                runner:{" "}
                {selectedScenario.runner_key ??
                  "-"}
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    "repeat(3, minmax(0, 1fr))",
                  gap: 10,
                  marginBottom: 18,
                }}
              >
                <div className="metric-card">
                  <div className="metric-label">
                    Type
                  </div>

                  <div
                    style={{
                      marginTop: 7,
                      fontSize: 12,
                    }}
                  >
                    {scenarioTypeLabel(
                      selectedScenario.scenario_type,
                    )}
                  </div>
                </div>

                <div className="metric-card">
                  <div className="metric-label">
                    Execution
                  </div>

                  <div
                    className="mono-muted"
                    style={{
                      marginTop: 7,
                    }}
                  >
                    {selectedScenario.execution_mode ??
                      "-"}
                  </div>
                </div>

                <div className="metric-card">
                  <div className="metric-label">
                    Platform
                  </div>

                  <div
                    className="mono-muted"
                    style={{
                      marginTop: 7,
                    }}
                  >
                    {selectedScenario.allowed_platforms
                      ?.join(", ") ?? "-"}
                  </div>
                </div>
              </div>

              {selectedScenario.description ? (
                <p
                  className="muted"
                  style={{
                    lineHeight: 1.6,
                    marginBottom: 18,
                  }}
                >
                  {selectedScenario.description}
                </p>
              ) : null}

              <form onSubmit={handleRun}>
                {selectedParameterKeys.length >
                0 ? (
                  <div
                    style={{
                      display: "grid",
                      gap: 14,
                    }}
                  >
                    {selectedParameterKeys.map(
                      (key) => (
                        <label
                          key={key}
                          style={{
                            display: "grid",
                            gap: 7,
                          }}
                        >
                          <span
                            className="metric-label"
                            style={{
                              textTransform:
                                "none",
                            }}
                          >
                            {key}
                          </span>

                          <input
                            className="input"
                            value={String(
                              parameters[key] ?? "",
                            )}
                            onChange={(event) =>
                              updateParameter(
                                key,
                                event.target.value,
                              )
                            }
                            autoComplete="off"
                          />
                        </label>
                      ),
                    )}
                  </div>
                ) : (
                  <div className="empty-state compact">
                    <span>
                      This scenario does not require
                      additional parameters.
                    </span>
                  </div>
                )}

                {runMessage ? (
                  <div
                    className={
                      runMessage.startsWith("Run ")
                        ? "success-state"
                        : "error-state"
                    }
                    style={{
                      marginTop: 16,
                    }}
                  >
                    {runMessage}
                  </div>
                ) : null}

                <div
                  className="row"
                  style={{
                    justifyContent: "flex-end",
                    marginTop: 20,
                  }}
                >
                  <button
                    type="button"
                    className="button"
                    onClick={closeRunner}
                    disabled={running}
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    className="button button-primary"
                    disabled={running}
                  >
                    <Play size={13} />

                    {running
                      ? "Starting..."
                      : "Run scenario"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}