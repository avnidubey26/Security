"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  Activity,
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Code2,
  Play,
  ShieldAlert,
  ToggleLeft,
  ToggleRight,
  XCircle,
} from "lucide-react";

import { get, post } from "@/lib/api";

interface DetectionRuleVersion {
  id: string;
  detection_rule_id: string;
  version: number;
  format: string;
  definition: Record<string, unknown>;
  severity: string;
  confidence: number;
  is_active: boolean;
  created_at: string;
  activated_at?: string | null;
}

interface DetectionRule {
  id: string;
  name: string;
  slug: string;
  description: string;
  status: string;
  created_at: string;
  updated_at: string;
  versions: DetectionRuleVersion[];
}

interface DetectionResult {
  id: string;
  detection_rule_version_id: string;
  evaluation_type: string;
  matched: boolean;
  evaluated_at: string;
  explanation: Record<string, unknown>;
  matched_event_ids: string[];
  context: Record<string, unknown>;
}

interface ScenarioRun {
  id: string;
  scenario_id: string;
  status: string;
  parameters?: Record<string, unknown> | null;
  started_at?: string | null;
  completed_at?: string | null;
  created_at?: string;
  error_message?: string | null;
}

function stringValue(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function numberValue(value: unknown, fallback = 0): number {
  return typeof value === "number" ? value : fallback;
}

function formatDate(value?: string | null): string {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString();
}

function prettyLabel(value: string): string {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function formatJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function severityClass(severity: string): string {
  switch (severity.toUpperCase()) {
    case "CRITICAL":
      return "border-red-500/30 bg-red-500/10 text-red-300";
    case "HIGH":
      return "border-orange-500/30 bg-orange-500/10 text-orange-300";
    case "MEDIUM":
      return "border-yellow-500/30 bg-yellow-500/10 text-yellow-300";
    case "LOW":
      return "border-blue-500/30 bg-blue-500/10 text-blue-300";
    default:
      return "border-slate-700 bg-slate-900 text-slate-300";
  }
}

function statusClass(status: string): string {
  switch (status.toUpperCase()) {
    case "ACTIVE":
      return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";
    case "DISABLED":
      return "border-slate-700 bg-slate-900 text-slate-400";
    default:
      return "border-slate-700 bg-slate-900 text-slate-300";
  }
}

function resultClass(matched: boolean): string {
  return matched
    ? "border-red-500/30 bg-red-500/10 text-red-300"
    : "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";
}

export default function DetectionDetailPage() {
  const params = useParams<{ id: string }>();
  const ruleId = params?.id;

  const [rule, setRule] = useState<DetectionRule | null>(null);
  const [results, setResults] = useState<DetectionResult[]>([]);
  const [scenarioRuns, setScenarioRuns] = useState<ScenarioRun[]>([]);

  const [selectedVersion, setSelectedVersion] =
    useState<DetectionRuleVersion | null>(null);

  const [selectedRunId, setSelectedRunId] = useState("");

  const [loading, setLoading] = useState(true);
  const [resultsLoading, setResultsLoading] = useState(false);
  const [runsLoading, setRunsLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const [error, setError] = useState<string | null>(null);

  async function loadRule() {
    if (!ruleId) return;

    setLoading(true);
    setError(null);

    try {
      const response = await get<DetectionRule>(`/detection-rules/${ruleId}`);

      const payload = response as DetectionRule & {
        data?: DetectionRule;
      };

      const loadedRule = payload.data ?? payload;

      setRule(loadedRule);

      const activeVersion =
        loadedRule.versions.find((version) => version.is_active) ??
        loadedRule.versions[0] ??
        null;

      setSelectedVersion(activeVersion);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to load detection rule.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function loadResults() {
    if (!ruleId) return;

    setResultsLoading(true);

    try {
      const response = await get<DetectionResult[]>(
        `/detection-rules/${ruleId}/results`,
      );

      const payload = response as
        | DetectionResult[]
        | {
            data?: DetectionResult[];
          };

      setResults(Array.isArray(payload) ? payload : payload.data ?? []);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to load detection results.",
      );
    } finally {
      setResultsLoading(false);
    }
  }

  async function loadScenarioRuns() {
    setRunsLoading(true);

    try {
      const response = await get<ScenarioRun[]>("/scenarios/runs");

      const payload = response as
        | ScenarioRun[]
        | {
            data?: ScenarioRun[];
          };

      setScenarioRuns(Array.isArray(payload) ? payload : payload.data ?? []);
    } catch {
      /*
       * Scenario runs are optional for the detection workspace.
       * The rule itself remains usable if the lab run registry is unavailable.
       */
    } finally {
      setRunsLoading(false);
    }
  }

  useEffect(() => {
    void loadRule();
    void loadResults();
    void loadScenarioRuns();
  }, [ruleId]);

  async function activateVersion(version: DetectionRuleVersion) {
    if (!ruleId || actionLoading) return;

    setActionLoading(true);
    setError(null);

    try {
      const response = await post<DetectionRuleVersion>(
        `/detection-rules/${ruleId}/versions/${version.version}/activate`,
        {},
      );

      const payload = response as DetectionRuleVersion & {
        data?: DetectionRuleVersion;
      };

      const activatedVersion = payload.data ?? payload;

      setRule((current) => {
        if (!current) return current;

        return {
          ...current,
          versions: current.versions.map((item) => ({
            ...item,
            is_active: item.version === activatedVersion.version,
          })),
        };
      });

      setSelectedVersion(activatedVersion);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to activate detection rule version.",
      );
    } finally {
      setActionLoading(false);
    }
  }

  async function evaluateVersion() {
    if (!ruleId || !selectedVersion || actionLoading) return;

    setActionLoading(true);
    setError(null);

    try {
      const response = await post<DetectionResult>(
        `/detection-rules/${ruleId}/versions/${selectedVersion.version}/evaluate`,
        selectedRunId ? { scenario_run_id: selectedRunId } : {},
      );

      const payload = response as DetectionResult & {
        data?: DetectionResult;
      };

      const result = payload.data ?? payload;

      setResults((current) => [result, ...current]);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to evaluate detection rule.",
      );
    } finally {
      setActionLoading(false);
    }
  }

  const activeVersion = useMemo(
    () => rule?.versions.find((version) => version.is_active) ?? null,
    [rule],
  );

  const matchedResults = useMemo(
    () => results.filter((result) => result.matched).length,
    [results],
  );

  if (loading) {
    return (
      <main className="page-body">
        <div className="flex min-h-[60vh] items-center justify-center">
          <p className="text-sm text-slate-400">
            Loading detection rule...
          </p>
        </div>
      </main>
    );
  }

  if (!rule) {
    return (
      <main className="page-body">
        <div className="mx-auto max-w-4xl">
          <Link
            href="/detections"
            className="mb-6 inline-flex items-center gap-2 text-sm text-slate-400 transition hover:text-slate-200"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to detections
          </Link>

          <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-8">
            <div className="flex items-center gap-3 text-red-300">
              <ShieldAlert className="h-5 w-5" />
              <h1 className="text-lg font-semibold">
                Detection rule not found
              </h1>
            </div>

            <p className="mt-2 text-sm text-slate-400">
              The requested detection rule could not be loaded.
            </p>

            {error && (
              <p className="mt-4 text-sm text-red-300">{error}</p>
            )}
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="page-body">
      <div className="mx-auto max-w-[1500px]">
        <div className="mb-6">
          <Link
            href="/detections"
            className="mb-4 inline-flex items-center gap-2 text-sm text-slate-400 transition hover:text-slate-200"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to detections
          </Link>

          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <span
                  className={`rounded-md border px-2.5 py-1 text-xs font-semibold uppercase tracking-wide ${statusClass(
                    rule.status,
                  )}`}
                >
                  {prettyLabel(rule.status)}
                </span>

                <span className="rounded-md border border-slate-700 bg-slate-900 px-2.5 py-1 font-mono text-xs text-slate-400">
                  {rule.slug}
                </span>

                {activeVersion && (
                  <span className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-300">
                    v{activeVersion.version} active
                  </span>
                )}
              </div>

              <h1 className="text-2xl font-semibold tracking-tight text-slate-100">
                {rule.name}
              </h1>

              <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-400">
                {rule.description}
              </p>

              <p className="mt-3 break-all font-mono text-xs text-slate-500">
                Rule ID: {rule.id}
              </p>
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-6 rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}

        <section className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-4">
            <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-slate-500">
              <Code2 className="h-4 w-4" />
              Versions
            </div>

            <p className="mt-3 text-xl font-semibold text-slate-100">
              {rule.versions.length}
            </p>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-4">
            <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-slate-500">
              <ToggleRight className="h-4 w-4" />
              Active Version
            </div>

            <p className="mt-3 text-xl font-semibold text-slate-100">
              {activeVersion ? `v${activeVersion.version}` : "None"}
            </p>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-4">
            <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-slate-500">
              <Activity className="h-4 w-4" />
              Evaluations
            </div>

            <p className="mt-3 text-xl font-semibold text-slate-100">
              {results.length}
            </p>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-4">
            <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-slate-500">
              <ShieldAlert className="h-4 w-4" />
              Matches
            </div>

            <p className="mt-3 text-xl font-semibold text-red-300">
              {matchedResults}
            </p>
          </div>
        </section>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.65fr)_minmax(320px,0.85fr)]">
          <div className="space-y-6">
            <section className="rounded-xl border border-slate-800 bg-slate-950/50">
              <div className="border-b border-slate-800 px-5 py-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h2 className="text-sm font-semibold text-slate-100">
                      Detection Versions
                    </h2>
                    <p className="mt-1 text-xs text-slate-500">
                      Versioned detection definitions with immutable evaluation
                      traceability.
                    </p>
                  </div>

                  <Code2 className="h-4 w-4 text-slate-500" />
                </div>
              </div>

              <div className="divide-y divide-slate-800">
                {rule.versions.length === 0 ? (
                  <div className="p-5 text-sm text-slate-500">
                    No detection versions exist for this rule.
                  </div>
                ) : (
                  rule.versions.map((version) => {
                    const selected =
                      selectedVersion?.version === version.version;

                    return (
                      <button
                        key={version.id}
                        type="button"
                        onClick={() => setSelectedVersion(version)}
                        className={`flex w-full flex-col gap-4 px-5 py-4 text-left transition md:flex-row md:items-center md:justify-between ${
                          selected
                            ? "bg-slate-900/80"
                            : "hover:bg-slate-900/40"
                        }`}
                      >
                        <div className="flex min-w-0 items-start gap-3">
                          <div
                            className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md border text-xs font-semibold ${
                              version.is_active
                                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                                : "border-slate-700 bg-slate-900 text-slate-400"
                            }`}
                          >
                            v{version.version}
                          </div>

                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-sm font-medium text-slate-200">
                                Version {version.version}
                              </span>

                              {version.is_active && (
                                <span className="rounded border border-emerald-500/20 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-300">
                                  Active
                                </span>
                              )}
                            </div>

                            <p className="mt-1 font-mono text-xs text-slate-500">
                              {version.format}
                            </p>
                          </div>
                        </div>

                        <div className="flex shrink-0 items-center gap-3">
                          <span
                            className={`rounded-md border px-2 py-1 text-[11px] font-semibold uppercase ${severityClass(
                              version.severity,
                            )}`}
                          >
                            {version.severity}
                          </span>

                          <span className="text-xs text-slate-400">
                            {version.confidence}% confidence
                          </span>

                          <ChevronDown
                            className={`h-4 w-4 text-slate-600 transition ${
                              selected ? "rotate-180" : ""
                            }`}
                          />
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </section>

            {selectedVersion && (
              <section className="rounded-xl border border-slate-800 bg-slate-950/50">
                <div className="border-b border-slate-800 px-5 py-4">
                  <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div>
                      <h2 className="text-sm font-semibold text-slate-100">
                        Version {selectedVersion.version} Definition
                      </h2>
                      <p className="mt-1 text-xs text-slate-500">
                        {selectedVersion.format} ·{" "}
                        {selectedVersion.confidence}% confidence ·{" "}
                        {selectedVersion.severity} severity
                      </p>
                    </div>

                    {!selectedVersion.is_active && (
                      <button
                        type="button"
                        disabled={actionLoading}
                        onClick={() => void activateVersion(selectedVersion)}
                        className="inline-flex items-center justify-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs font-medium text-emerald-300 transition hover:bg-emerald-500/15 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <ToggleRight className="h-4 w-4" />
                        Activate Version
                      </button>
                    )}
                  </div>
                </div>

                <div className="p-5">
                  <pre className="max-h-[520px] overflow-auto rounded-lg border border-slate-800 bg-slate-950 p-4 font-mono text-xs leading-6 text-slate-300">
                    {formatJson(selectedVersion.definition)}
                  </pre>

                  <div className="mt-4 grid gap-3 md:grid-cols-3">
                    <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-3">
                      <p className="text-[10px] uppercase tracking-wider text-slate-500">
                        Created
                      </p>
                      <p className="mt-1 text-xs text-slate-300">
                        {formatDate(selectedVersion.created_at)}
                      </p>
                    </div>

                    <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-3">
                      <p className="text-[10px] uppercase tracking-wider text-slate-500">
                        Activated
                      </p>
                      <p className="mt-1 text-xs text-slate-300">
                        {formatDate(selectedVersion.activated_at)}
                      </p>
                    </div>

                    <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-3">
                      <p className="text-[10px] uppercase tracking-wider text-slate-500">
                        Version ID
                      </p>
                      <p className="mt-1 break-all font-mono text-[10px] text-slate-400">
                        {selectedVersion.id}
                      </p>
                    </div>
                  </div>
                </div>
              </section>
            )}

            <section className="rounded-xl border border-slate-800 bg-slate-950/50">
              <div className="border-b border-slate-800 px-5 py-4">
                <div>
                  <h2 className="text-sm font-semibold text-slate-100">
                    Evaluation Results
                  </h2>
                  <p className="mt-1 text-xs text-slate-500">
                    Historical detection evaluations and their explainable
                    outputs.
                  </p>
                </div>
              </div>

              <div className="divide-y divide-slate-800">
                {resultsLoading ? (
                  <div className="p-5 text-sm text-slate-500">
                    Loading evaluation results...
                  </div>
                ) : results.length === 0 ? (
                  <div className="p-5 text-sm text-slate-500">
                    No evaluation results recorded yet.
                  </div>
                ) : (
                  results.map((result) => (
                    <div key={result.id} className="px-5 py-4">
                      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className={`rounded-md border px-2 py-1 text-[10px] font-semibold uppercase tracking-wide ${resultClass(
                                result.matched,
                              )}`}
                            >
                              {result.matched ? "Matched" : "No Match"}
                            </span>

                            <span className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-[10px] uppercase tracking-wide text-slate-500">
                              {prettyLabel(result.evaluation_type)}
                            </span>
                          </div>

                          <p className="mt-2 break-all font-mono text-[11px] text-slate-500">
                            {result.id}
                          </p>
                        </div>

                        <p className="shrink-0 text-xs text-slate-500">
                          {formatDate(result.evaluated_at)}
                        </p>
                      </div>

                      <div className="mt-4 grid gap-3 md:grid-cols-2">
                        <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-3">
                          <p className="text-[10px] uppercase tracking-wider text-slate-500">
                            Matched Events
                          </p>

                          <p className="mt-1 text-sm font-semibold text-slate-200">
                            {result.matched_event_ids.length}
                          </p>
                        </div>

                        <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-3">
                          <p className="text-[10px] uppercase tracking-wider text-slate-500">
                            Rule Version
                          </p>

                          <p className="mt-1 break-all font-mono text-[10px] text-slate-400">
                            {result.detection_rule_version_id}
                          </p>
                        </div>
                      </div>

                      {Object.keys(result.explanation).length > 0 && (
                        <div className="mt-3">
                          <p className="mb-2 text-[10px] uppercase tracking-wider text-slate-500">
                            Explanation
                          </p>

                          <pre className="max-h-64 overflow-auto rounded-lg border border-slate-800 bg-slate-950 p-3 font-mono text-[11px] leading-5 text-slate-400">
                            {formatJson(result.explanation)}
                          </pre>
                        </div>
                      )}

                      {result.matched_event_ids.length > 0 && (
                        <div className="mt-3">
                          <p className="mb-2 text-[10px] uppercase tracking-wider text-slate-500">
                            Matched Event IDs
                          </p>

                          <div className="space-y-1">
                            {result.matched_event_ids.map((eventId) => (
                              <p
                                key={eventId}
                                className="break-all rounded border border-slate-800 bg-slate-950 px-3 py-2 font-mono text-[10px] text-slate-500"
                              >
                                {eventId}
                              </p>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </section>
          </div>

          <aside className="space-y-6">
            <section className="rounded-xl border border-slate-800 bg-slate-950/50">
              <div className="border-b border-slate-800 px-5 py-4">
                <h2 className="text-sm font-semibold text-slate-100">
                  Evaluate Detection
                </h2>

                <p className="mt-1 text-xs leading-5 text-slate-500">
                  Run the selected rule version against an optional controlled
                  lab scenario run.
                </p>
              </div>

              <div className="space-y-4 p-5">
                <div>
                  <label
                    htmlFor="scenario-run"
                    className="mb-2 block text-xs font-medium uppercase tracking-wider text-slate-500"
                  >
                    Scenario Run
                  </label>

                  <select
                    id="scenario-run"
                    value={selectedRunId}
                    onChange={(event) => setSelectedRunId(event.target.value)}
                    disabled={runsLoading || actionLoading}
                    className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2.5 text-xs text-slate-300 outline-none transition focus:border-slate-500 disabled:opacity-50"
                  >
                    <option value="">
                      {runsLoading
                        ? "Loading scenario runs..."
                        : "Evaluate without a specific run"}
                    </option>

                    {scenarioRuns.map((run) => (
                      <option key={run.id} value={run.id}>
                        {run.id} · {run.status}
                      </option>
                    ))}
                  </select>

                  <p className="mt-2 text-[11px] leading-5 text-slate-600">
                    Selecting a run makes the evaluation traceable to that
                    controlled telemetry execution.
                  </p>
                </div>

                <button
                  type="button"
                  disabled={!selectedVersion || actionLoading}
                  onClick={() => void evaluateVersion()}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-slate-600 bg-slate-800 px-4 py-2.5 text-sm font-medium text-slate-100 transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Play className="h-4 w-4" />
                  {actionLoading ? "Evaluating..." : "Evaluate Version"}
                </button>
              </div>
            </section>

            <section className="rounded-xl border border-slate-800 bg-slate-950/50">
              <div className="border-b border-slate-800 px-5 py-4">
                <h2 className="text-sm font-semibold text-slate-100">
                  Rule Metadata
                </h2>
              </div>

              <div className="space-y-4 p-5">
                <div>
                  <p className="text-xs uppercase tracking-wider text-slate-500">
                    Rule ID
                  </p>
                  <p className="mt-2 break-all font-mono text-[11px] leading-5 text-slate-400">
                    {rule.id}
                  </p>
                </div>

                <div className="border-t border-slate-800 pt-4">
                  <p className="text-xs uppercase tracking-wider text-slate-500">
                    Slug
                  </p>
                  <p className="mt-2 break-all font-mono text-xs text-slate-300">
                    {rule.slug}
                  </p>
                </div>

                <div className="border-t border-slate-800 pt-4">
                  <p className="text-xs uppercase tracking-wider text-slate-500">
                    Created
                  </p>
                  <p className="mt-2 text-sm text-slate-300">
                    {formatDate(rule.created_at)}
                  </p>
                </div>

                <div className="border-t border-slate-800 pt-4">
                  <p className="text-xs uppercase tracking-wider text-slate-500">
                    Updated
                  </p>
                  <p className="mt-2 text-sm text-slate-300">
                    {formatDate(rule.updated_at)}
                  </p>
                </div>
              </div>
            </section>

            <section className="rounded-xl border border-slate-800 bg-slate-950/50 p-5">
              <div className="flex items-start gap-3">
                {rule.status.toUpperCase() === "ACTIVE" ? (
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" />
                ) : (
                  <ToggleLeft className="mt-0.5 h-5 w-5 shrink-0 text-slate-500" />
                )}

                <div>
                  <h2 className="text-sm font-semibold text-slate-200">
                    Detection Lifecycle
                  </h2>

                  <p className="mt-2 text-xs leading-5 text-slate-500">
                    Detection rules are versioned so historical alerts remain
                    traceable to the exact definition that produced them.
                  </p>
                </div>
              </div>
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}