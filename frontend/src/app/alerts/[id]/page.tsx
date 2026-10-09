"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Clock3,
  ExternalLink,
  FileText,
  ShieldAlert,
  XCircle,
} from "lucide-react";

import { get, patch, post } from "@/lib/api";

interface AlertEvent {
  id: string;
  security_event_id: string;
  relationship_type: string;
}

interface AlertDetail {
  id: string;
  detection_result_id: string;
  detection_rule_version_id: string;
  title: string;
  severity: string;
  confidence: number;
  status: string;
  explanation: Record<string, unknown>;
  context: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  acknowledged_at?: string | null;
  resolved_at?: string | null;
  events: AlertEvent[];
}

const statusOptions = ["NEW", "ACKNOWLEDGED", "RESOLVED", "DISMISSED"];

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
      return "border-slate-500/30 bg-slate-500/10 text-slate-300";
  }
}

function statusClass(status: string): string {
  switch (status.toUpperCase()) {
    case "NEW":
      return "border-red-500/30 bg-red-500/10 text-red-300";
    case "ACKNOWLEDGED":
      return "border-yellow-500/30 bg-yellow-500/10 text-yellow-300";
    case "RESOLVED":
      return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";
    case "DISMISSED":
      return "border-slate-500/30 bg-slate-500/10 text-slate-300";
    default:
      return "border-slate-500/30 bg-slate-500/10 text-slate-300";
  }
}

function prettyLabel(value: string): string {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

export default function AlertDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();

  const alertId = params?.id;

  const [alert, setAlert] = useState<AlertDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadAlert() {
    if (!alertId) return;

    setLoading(true);
    setError(null);

    try {
      const response = await get<AlertDetail>(`/alerts/${alertId}`);

      const payload = response as AlertDetail & {
        data?: AlertDetail;
      };

      setAlert(payload.data ?? payload);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to load alert.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadAlert();
  }, [alertId]);

  async function updateStatus(status: string) {
    if (!alertId || actionLoading) return;

    setActionLoading(true);
    setError(null);

    try {
      await patch(`/alerts/${alertId}`, { status });
      await loadAlert();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to update alert status.",
      );
    } finally {
      setActionLoading(false);
    }
  }

  async function runAction(
    action: "acknowledge" | "resolve" | "dismiss",
  ) {
    if (!alertId || actionLoading) return;

    setActionLoading(true);
    setError(null);

    try {
      await post(`/alerts/${alertId}/${action}`, {});
      await loadAlert();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : `Unable to ${action} alert.`,
      );
    } finally {
      setActionLoading(false);
    }
  }

  const explanationEntries = useMemo(() => {
    if (!alert?.explanation) return [];

    return Object.entries(alert.explanation);
  }, [alert]);

  const contextEntries = useMemo(() => {
    if (!alert?.context) return [];

    return Object.entries(alert.context);
  }, [alert]);

  if (loading) {
    return (
      <main className="page-body">
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="text-sm text-slate-400">Loading alert...</div>
        </div>
      </main>
    );
  }

  if (!alert) {
    return (
      <main className="page-body">
        <div className="mx-auto max-w-4xl">
          <Link
            href="/alerts"
            className="mb-6 inline-flex items-center gap-2 text-sm text-slate-400 transition hover:text-slate-200"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to alerts
          </Link>

          <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-8">
            <div className="flex items-center gap-3 text-red-300">
              <AlertTriangle className="h-5 w-5" />
              <h1 className="text-lg font-semibold">Alert not found</h1>
            </div>

            <p className="mt-2 text-sm text-slate-400">
              The requested alert could not be loaded.
            </p>

            {error && (
              <p className="mt-4 text-sm text-red-300">{error}</p>
            )}
          </div>
        </div>
      </main>
    );
  }

  const severity = stringValue(alert.severity, "UNKNOWN");
  const status = stringValue(alert.status, "UNKNOWN");
  const confidence = numberValue(alert.confidence);

  return (
    <main className="page-body">
      <div className="mx-auto max-w-[1500px]">
        <div className="mb-6">
          <Link
            href="/alerts"
            className="mb-4 inline-flex items-center gap-2 text-sm text-slate-400 transition hover:text-slate-200"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to alerts
          </Link>

          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <span
                  className={`rounded-md border px-2.5 py-1 text-xs font-semibold uppercase tracking-wide ${severityClass(
                    severity,
                  )}`}
                >
                  {severity}
                </span>

                <span
                  className={`rounded-md border px-2.5 py-1 text-xs font-semibold uppercase tracking-wide ${statusClass(
                    status,
                  )}`}
                >
                  {status}
                </span>

                <span className="rounded-md border border-slate-700 bg-slate-900/60 px-2.5 py-1 text-xs text-slate-400">
                  Confidence {confidence}%
                </span>
              </div>

              <h1 className="text-2xl font-semibold tracking-tight text-slate-100">
                {alert.title}
              </h1>

              <p className="mt-2 max-w-4xl break-all font-mono text-xs text-slate-500">
                Alert ID: {alert.id}
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {status === "NEW" && (
                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={() => runAction("acknowledge")}
                  className="inline-flex items-center gap-2 rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-3 py-2 text-sm font-medium text-yellow-300 transition hover:bg-yellow-500/15 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Clock3 className="h-4 w-4" />
                  Acknowledge
                </button>
              )}

              {status !== "RESOLVED" && status !== "DISMISSED" && (
                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={() => runAction("resolve")}
                  className="inline-flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm font-medium text-emerald-300 transition hover:bg-emerald-500/15 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Resolve
                </button>
              )}

              {status !== "DISMISSED" && status !== "RESOLVED" && (
                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={() => runAction("dismiss")}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm font-medium text-slate-300 transition hover:border-slate-600 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <XCircle className="h-4 w-4" />
                  Dismiss
                </button>
              )}
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
              <ShieldAlert className="h-4 w-4" />
              Severity
            </div>
            <p className="mt-3 text-xl font-semibold text-slate-100">
              {severity}
            </p>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-4">
            <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-slate-500">
              <CheckCircle2 className="h-4 w-4" />
              Confidence
            </div>
            <div className="mt-3">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-slate-200">
                  {confidence}%
                </span>
                <span className="text-xs text-slate-500">Detection confidence</span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-800">
                <div
                  className="h-full rounded-full bg-emerald-500 transition-all"
                  style={{ width: `${Math.min(Math.max(confidence, 0), 100)}%` }}
                />
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-4">
            <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-slate-500">
              <FileText className="h-4 w-4" />
              Linked Events
            </div>
            <p className="mt-3 text-xl font-semibold text-slate-100">
              {alert.events.length}
            </p>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-4">
            <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-slate-500">
              <Clock3 className="h-4 w-4" />
              Created
            </div>
            <p className="mt-3 text-sm font-medium text-slate-200">
              {formatDate(alert.created_at)}
            </p>
          </div>
        </section>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.7fr)_minmax(320px,0.8fr)]">
          <div className="space-y-6">
            <section className="rounded-xl border border-slate-800 bg-slate-950/50">
              <div className="border-b border-slate-800 px-5 py-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h2 className="text-sm font-semibold text-slate-100">
                      Detection Explanation
                    </h2>
                    <p className="mt-1 text-xs text-slate-500">
                      Explainable output produced by the detection engine.
                    </p>
                  </div>

                  <ShieldAlert className="h-4 w-4 text-slate-500" />
                </div>
              </div>

              <div className="p-5">
                {explanationEntries.length > 0 ? (
                  <div className="space-y-3">
                    {explanationEntries.map(([key, value]) => (
                      <div
                        key={key}
                        className="rounded-lg border border-slate-800 bg-slate-900/50 p-4"
                      >
                        <p className="mb-2 text-xs font-medium uppercase tracking-wider text-slate-500">
                          {prettyLabel(key)}
                        </p>

                        {typeof value === "object" && value !== null ? (
                          <pre className="overflow-x-auto whitespace-pre-wrap break-words font-mono text-xs leading-5 text-slate-300">
                            {formatJson(value)}
                          </pre>
                        ) : (
                          <p className="break-words text-sm leading-6 text-slate-300">
                            {String(value)}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">
                    No detection explanation was recorded.
                  </p>
                )}
              </div>
            </section>

            <section className="rounded-xl border border-slate-800 bg-slate-950/50">
              <div className="border-b border-slate-800 px-5 py-4">
                <h2 className="text-sm font-semibold text-slate-100">
                  Linked Security Events
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  Events associated with this detection alert.
                </p>
              </div>

              <div className="divide-y divide-slate-800">
                {alert.events.length === 0 ? (
                  <div className="p-5 text-sm text-slate-500">
                    No security events are linked to this alert.
                  </div>
                ) : (
                  alert.events.map((event, index) => (
                    <div
                      key={event.id}
                      className="flex flex-col gap-3 px-5 py-4 md:flex-row md:items-center md:justify-between"
                    >
                      <div className="flex min-w-0 items-start gap-3">
                        <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-slate-700 bg-slate-900 text-xs font-semibold text-slate-400">
                          {index + 1}
                        </div>

                        <div className="min-w-0">
                          <p className="text-sm font-medium text-slate-200">
                            Security Event
                          </p>

                          <p className="mt-1 break-all font-mono text-xs text-slate-500">
                            {event.security_event_id}
                          </p>
                        </div>
                      </div>

                      <span className="w-fit shrink-0 rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-[11px] font-medium uppercase tracking-wide text-slate-400">
                        {prettyLabel(event.relationship_type)}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </section>

            <section className="rounded-xl border border-slate-800 bg-slate-950/50">
              <div className="border-b border-slate-800 px-5 py-4">
                <h2 className="text-sm font-semibold text-slate-100">
                  Alert Context
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  Structured context captured during detection evaluation.
                </p>
              </div>

              <div className="p-5">
                {contextEntries.length > 0 ? (
                  <pre className="overflow-x-auto rounded-lg border border-slate-800 bg-slate-950 p-4 font-mono text-xs leading-6 text-slate-300">
                    {formatJson(alert.context)}
                  </pre>
                ) : (
                  <p className="text-sm text-slate-500">
                    No additional context was recorded.
                  </p>
                )}
              </div>
            </section>
          </div>

          <aside className="space-y-6">
            <section className="rounded-xl border border-slate-800 bg-slate-950/50">
              <div className="border-b border-slate-800 px-5 py-4">
                <h2 className="text-sm font-semibold text-slate-100">
                  Detection Trace
                </h2>
              </div>

              <div className="space-y-4 p-5">
                <div>
                  <p className="text-xs uppercase tracking-wider text-slate-500">
                    Detection Result
                  </p>
                  <p className="mt-2 break-all font-mono text-xs leading-5 text-slate-300">
                    {alert.detection_result_id}
                  </p>
                </div>

                <div className="border-t border-slate-800 pt-4">
                  <p className="text-xs uppercase tracking-wider text-slate-500">
                    Rule Version
                  </p>
                  <p className="mt-2 break-all font-mono text-xs leading-5 text-slate-300">
                    {alert.detection_rule_version_id}
                  </p>
                </div>

                <div className="border-t border-slate-800 pt-4">
                  <p className="text-xs uppercase tracking-wider text-slate-500">
                    Alert ID
                  </p>
                  <p className="mt-2 break-all font-mono text-xs leading-5 text-slate-300">
                    {alert.id}
                  </p>
                </div>
              </div>
            </section>

            <section className="rounded-xl border border-slate-800 bg-slate-950/50">
              <div className="border-b border-slate-800 px-5 py-4">
                <h2 className="text-sm font-semibold text-slate-100">
                  Lifecycle
                </h2>
              </div>

              <div className="space-y-4 p-5">
                <div className="flex gap-3">
                  <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-slate-500" />
                  <div>
                    <p className="text-xs uppercase tracking-wider text-slate-500">
                      Created
                    </p>
                    <p className="mt-1 text-sm text-slate-300">
                      {formatDate(alert.created_at)}
                    </p>
                  </div>
                </div>

                {alert.acknowledged_at && (
                  <div className="flex gap-3">
                    <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-yellow-400" />
                    <div>
                      <p className="text-xs uppercase tracking-wider text-slate-500">
                        Acknowledged
                      </p>
                      <p className="mt-1 text-sm text-slate-300">
                        {formatDate(alert.acknowledged_at)}
                      </p>
                    </div>
                  </div>
                )}

                {alert.resolved_at && (
                  <div className="flex gap-3">
                    <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-emerald-400" />
                    <div>
                      <p className="text-xs uppercase tracking-wider text-slate-500">
                        Resolved
                      </p>
                      <p className="mt-1 text-sm text-slate-300">
                        {formatDate(alert.resolved_at)}
                      </p>
                    </div>
                  </div>
                )}

                <div className="flex gap-3">
                  <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-slate-600" />
                  <div>
                    <p className="text-xs uppercase tracking-wider text-slate-500">
                      Last Updated
                    </p>
                    <p className="mt-1 text-sm text-slate-300">
                      {formatDate(alert.updated_at)}
                    </p>
                  </div>
                </div>
              </div>
            </section>

            <section className="rounded-xl border border-slate-800 bg-slate-950/50">
              <div className="border-b border-slate-800 px-5 py-4">
                <h2 className="text-sm font-semibold text-slate-100">
                  Status Controls
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  Server-side lifecycle controls for this alert.
                </p>
              </div>

              <div className="space-y-2 p-5">
                {statusOptions.map((option) => (
                  <button
                    key={option}
                    type="button"
                    disabled={actionLoading || status === option}
                    onClick={() => updateStatus(option)}
                    className={`flex w-full items-center justify-between rounded-lg border px-3 py-2.5 text-left text-xs font-medium transition ${
                      status === option
                        ? "cursor-default border-slate-700 bg-slate-800 text-slate-200"
                        : "border-slate-800 bg-slate-950 text-slate-400 hover:border-slate-700 hover:bg-slate-900 hover:text-slate-200"
                    } disabled:opacity-50`}
                  >
                    <span>{prettyLabel(option)}</span>
                    {status === option && (
                      <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                    )}
                  </button>
                ))}
              </div>
            </section>

            <section className="rounded-xl border border-slate-800 bg-slate-950/50">
              <div className="p-5">
                <div className="flex items-start gap-3">
                  <ExternalLink className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />

                  <div>
                    <h2 className="text-sm font-semibold text-slate-200">
                      Investigation workflow
                    </h2>

                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      This alert can be linked to an investigation for deeper
                      timeline reconstruction, evidence collection and incident
                      reporting.
                    </p>

                    <button
                      type="button"
                      onClick={() => router.push("/investigations")}
                      className="mt-3 text-xs font-medium text-slate-300 transition hover:text-white"
                    >
                      Open investigations →
                    </button>
                  </div>
                </div>
              </div>
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}