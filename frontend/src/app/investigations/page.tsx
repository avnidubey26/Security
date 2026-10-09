"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
    AlertCircle,
    CalendarDays,
    ChevronRight,
    Clock3,
    RefreshCw,
    Search,
    ShieldAlert,
    UserRound,
} from "lucide-react";

import { api, ApiError } from "@/lib/api";
import type { Investigation } from "@/types/api";



function normalizeInvestigations(response: unknown): Investigation[] {
    if (Array.isArray(response)) {
        return response;
    }

    if (
        response &&
        typeof response === "object" &&
        "data" in response
    ) {
        const data = response.data;

        if (Array.isArray(data)) {
            return data;
        }

        if (
            data &&
            typeof data === "object" &&
            "items" in data &&
            Array.isArray(data.items)
        ) {
            return data.items;
        }
    }

    if (
        response &&
        typeof response === "object" &&
        "items" in response &&
        Array.isArray(response.items)
    ) {
        return response.items;
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

function formatShortId(id: string): string {
    return `${id.slice(0, 8)}...`;
}

function getStatusClass(status: Investigation["status"]): string {
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

function getPriorityClass(priority: Investigation["priority"]): string {
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

export default function InvestigationsPage() {
    const [investigations, setInvestigations] = useState<Investigation[]>([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const loadInvestigations = useCallback(async () => {
        setLoading(true);
        setError(null);

        try {
            const response = await api.get<unknown>("/investigations");

            setInvestigations(normalizeInvestigations(response));
        } catch (err) {
            if (err instanceof ApiError) {
                setError(err.message);
            } else {
                setError("Unable to load investigations.");
            }
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void loadInvestigations();
    }, [loadInvestigations]);

    const filteredInvestigations = investigations.filter((investigation) => {
        const query = searchQuery.trim().toLowerCase();

        if (!query) {
            return true;
        }

        return (
            investigation.title.toLowerCase().includes(query) ||
            investigation.status.toLowerCase().includes(query) ||
            investigation.priority.toLowerCase().includes(query) ||
            investigation.id.toLowerCase().includes(query) ||
            (investigation.assigned_to ?? "").toLowerCase().includes(query)
        );
    });

    return (
        <div className="content">
            <div className="page-header">
                <div>
                    <p className="eyebrow">Investigation workspace</p>

                    <h1>Investigations</h1>

                    <p className="muted" style={{ marginTop: 8 }}>
                        Investigate security alerts, reconstruct activity, preserve
                        evidence, and document incident findings.
                    </p>
                </div>

                <button
                    type="button"
                    className="button"
                    onClick={() => void loadInvestigations()}
                    disabled={loading}
                >
                    <RefreshCw size={14} className={loading ? "loading-icon" : ""} />
                    Refresh
                </button>
            </div>

            <div className="metrics-grid">
                <div className="metric-card">
                    <div className="metric-label">Total investigations</div>
                    <div className="metric-value">{investigations.length}</div>
                    <div className="metric-detail">Tracked investigations</div>
                </div>

                <div className="metric-card">
                    <div className="metric-label">Open</div>
                    <div className="metric-value">
                        {
                            investigations.filter(
                                (investigation) => investigation.status === "OPEN",
                            ).length
                        }
                    </div>
                    <div className="metric-detail">Awaiting analyst action</div>
                </div>

                <div className="metric-card">
                    <div className="metric-label">In progress</div>
                    <div className="metric-value">
                        {
                            investigations.filter(
                                (investigation) => investigation.status === "IN_PROGRESS",
                            ).length
                        }
                    </div>
                    <div className="metric-detail">Active analyst work</div>
                </div>

                <div className="metric-card">
                    <div className="metric-label">Contained</div>
                    <div className="metric-value">
                        {
                            investigations.filter(
                                (investigation) => investigation.status === "CONTAINED",
                            ).length
                        }
                    </div>
                    <div className="metric-detail">Threat contained</div>
                </div>
            </div>

            <section className="panel">
                <div className="panel-header">
                    <div className="row">
                        <ShieldAlert size={15} color="var(--accent)" />
                        <span className="panel-title">Investigation queue</span>
                    </div>

                    <div
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            width: "min(320px, 100%)",
                        }}
                    >
                        <Search size={14} color="var(--muted)" />

                        <input
                            className="input"
                            type="search"
                            placeholder="Search investigations..."
                            value={searchQuery}
                            onChange={(event) => setSearchQuery(event.target.value)}
                            aria-label="Search investigations"
                        />
                    </div>
                </div>

                {loading ? (
                    <div className="panel-body">
                        <div className="empty-state">
                            <div>
                                <Clock3 size={18} />
                                <div
                                    className="empty-state-title"
                                    style={{ marginTop: 10 }}
                                >
                                    Loading investigations
                                </div>
                                <p className="empty-state-description">
                                    Retrieving investigation records from the security API.
                                </p>
                            </div>
                        </div>
                    </div>
                ) : error ? (
                    <div className="panel-body">
                        <div className="error-state">
                            <div className="row">
                                <AlertCircle size={15} />
                                <strong>Investigation data unavailable</strong>
                            </div>

                            <div style={{ marginTop: 6 }}>{error}</div>

                            <button
                                type="button"
                                className="button button-danger"
                                style={{ marginTop: 12 }}
                                onClick={() => void loadInvestigations()}
                            >
                                <RefreshCw size={13} />
                                Retry
                            </button>
                        </div>
                    </div>
                ) : filteredInvestigations.length === 0 ? (
                    <div className="panel-body">
                        <div className="empty-state">
                            <div>
                                <ShieldAlert size={20} />
                                <div
                                    className="empty-state-title"
                                    style={{ marginTop: 10 }}
                                >
                                    {searchQuery
                                        ? "No matching investigations"
                                        : "No investigations found"}
                                </div>

                                <p className="empty-state-description">
                                    {searchQuery
                                        ? "Try a different investigation title, status, priority, or analyst."
                                        : "Investigation records will appear here when alerts are investigated."}
                                </p>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="table-container">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>Investigation</th>
                                    <th>Status</th>
                                    <th>Priority</th>
                                    <th>Assigned analyst</th>
                                    <th>Started</th>
                                    <th>Updated</th>
                                    <th aria-label="Open investigation" />
                                </tr>
                            </thead>

                            <tbody>
                                {filteredInvestigations.map((investigation) => (
                                    <tr key={investigation.id}>
                                        <td>
                                            <Link
                                                href={`/investigations/${investigation.id}`}
                                                style={{
                                                    display: "grid",
                                                    gap: 3,
                                                    minWidth: 220,
                                                }}
                                            >
                                                <span
                                                    style={{
                                                        color: "var(--text)",
                                                        fontWeight: 600,
                                                    }}
                                                >
                                                    {investigation.title}
                                                </span>

                                                <span className="mono-muted">
                                                    {formatShortId(investigation.id)}
                                                </span>
                                            </Link>
                                        </td>

                                        <td>
                                            <span
                                                className={`badge ${getStatusClass(
                                                    investigation.status,
                                                )}`}
                                            >
                                                {investigation.status.replaceAll("_", " ")}
                                            </span>
                                        </td>

                                        <td>
                                            <span
                                                className={getPriorityClass(
                                                    investigation.priority,
                                                )}
                                                style={{
                                                    fontFamily: "var(--font-mono)",
                                                    fontSize: 10,
                                                    fontWeight: 600,
                                                    textTransform: "uppercase",
                                                }}
                                            >
                                                {investigation.priority}
                                            </span>
                                        </td>

                                        <td>
                                            <span className="row">
                                                <UserRound size={13} color="var(--muted)" />
                                                {investigation.assigned_to ?? "Unassigned"}
                                            </span>
                                        </td>

                                        <td>
                                            <span className="row mono-muted">
                                                <CalendarDays size={12} />
                                                {formatDate(investigation.started_at)}
                                            </span>
                                        </td>

                                        <td>
                                            <span className="mono-muted">
                                                {formatDate(investigation.updated_at)}
                                            </span>
                                        </td>

                                        <td>
                                            <Link
                                                href={`/investigations/${investigation.id}`}
                                                className="icon-button"
                                                aria-label={`Open ${investigation.title}`}
                                            >
                                                <ChevronRight size={15} />
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