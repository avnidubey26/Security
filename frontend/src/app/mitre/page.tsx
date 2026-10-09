"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  BookOpen,
  Crosshair,
  Filter,
  RefreshCw,
  Search,
  Shield,
  Target,
} from "lucide-react";

import { api, ApiError } from "@/lib/api";
import type { MitreTechnique } from "@/types/api";

type TechniqueResponse =
  | MitreTechnique[]
  | {
      data?: MitreTechnique[];
      items?: MitreTechnique[];
      total?: number;
    };

function normalizeTechniques(
  response: unknown,
): MitreTechnique[] {
  let records: unknown[] = [];

  if (Array.isArray(response)) {
    records = response;
  } else if (response && typeof response === "object") {
    const value = response as Record<string, unknown>;

    if (Array.isArray(value.data)) {
      records = value.data;
    } else if (Array.isArray(value.items)) {
      records = value.items;
    } else if (Array.isArray(value.techniques)) {
      records = value.techniques;
    }
  }

  return records
    .filter(
      (item): item is Record<string, unknown> =>
        Boolean(item) &&
        typeof item === "object" &&
        !Array.isArray(item),
    )
    .map((item, index) => {
      const nested =
        item.technique &&
        typeof item.technique === "object" &&
        !Array.isArray(item.technique)
          ? (item.technique as Record<string, unknown>)
          : null;

      const techniqueId =
        item.technique_id ??
        item.techniqueId ??
        item.external_id ??
        item.id ??
        nested?.technique_id ??
        nested?.techniqueId ??
        nested?.id ??
        "";

      const name =
        item.name ??
        nested?.name ??
        "Unknown technique";

      const description =
        item.description ??
        nested?.description ??
        null;

      const tactic =
        item.tactic ??
        item.tactic_id ??
        nested?.tactic ??
        nested?.tactic_id ??
        null;

      const id =
        item.id ??
        item.mapping_id ??
        nested?.id ??
        `technique-${index}`;

      return {
        id: String(id),
        technique_id: String(techniqueId),
        name: String(name),
        description:
          description === null || description === undefined
            ? null
            : String(description),
        tactic:
          tactic === null || tactic === undefined
            ? null
            : String(tactic),
        parent_technique_id:
          typeof (
            item.parent_technique_id ??
            nested?.parent_technique_id
          ) === "string"
            ? (item.parent_technique_id ??
                nested?.parent_technique_id) as string
            : null,
      };
    })
    .filter((technique) => technique.technique_id.length > 0);
}

function techniqueId(
  technique: MitreTechnique,
): string {
  return technique.technique_id || "UNKNOWN";
}

function shortId(
  value: string | null | undefined,
): string {
  if (!value) {
    return "-";
  }

  return `${value.slice(0, 8)}...`;
}

export default function MitrePage() {
  const [techniques, setTechniques] = useState<
    MitreTechnique[]
  >([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(
    null,
  );

  const [search, setSearch] = useState("");
  const [tacticFilter, setTacticFilter] =
    useState("ALL");

  const loadTechniques = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response =
        await api.get<TechniqueResponse>(
          "/mitre/techniques",
        );

      setTechniques(normalizeTechniques(response));
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError(
          "Unable to load MITRE ATT&CK techniques.",
        );
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadTechniques();
  }, [loadTechniques]);

  const tactics = useMemo(() => {
    return Array.from(
      new Set(
        techniques
          .map((technique) => technique.tactic)
          .filter(
            (tactic): tactic is string =>
              Boolean(tactic),
          ),
      ),
    ).sort();
  }, [techniques]);

  const filteredTechniques = useMemo(() => {
    const query = search.trim().toLowerCase();

    return techniques.filter((technique) => {
      const matchesSearch =
        !query ||
        techniqueId(technique)
          .toLowerCase()
          .includes(query) ||
        technique.name
          .toLowerCase()
          .includes(query) ||
        technique.tactic
          ?.toLowerCase()
          .includes(query) ||
        technique.description
          ?.toLowerCase()
          .includes(query);

      const matchesTactic =
        tacticFilter === "ALL" ||
        technique.tactic === tacticFilter;

      return matchesSearch && matchesTactic;
    });
  }, [techniques, search, tacticFilter]);

  const metrics = useMemo(
    () => ({
      total: techniques.length,

      tactics: new Set(
        techniques
          .map((technique) => technique.tactic)
          .filter(Boolean),
      ).size,

      subtechniques: techniques.filter(
        (technique) =>
          techniqueId(technique).includes("."),
      ).length,

      parentTechniques: techniques.filter(
        (technique) =>
          !techniqueId(technique).includes("."),
      ).length,
    }),
    [techniques],
  );

  return (
    <div className="content">
      <div className="page-header">
        <div>
          <p className="eyebrow">
            Adversary behavior framework
          </p>

          <div className="row" style={{ gap: 10 }}>
            <Shield
              size={22}
              color="var(--accent)"
            />

            <h1>MITRE ATT&CK</h1>
          </div>

          <p className="page-description">
            Technique registry used to classify observed
            adversary behavior across investigations and
            detection engineering workflows.
          </p>
        </div>

        <button
          type="button"
          className="button"
          onClick={() => void loadTechniques()}
          disabled={loading}
        >
          <RefreshCw
            size={14}
            className={
              loading ? "loading-icon" : ""
            }
          />
          Refresh
        </button>
      </div>

      <section className="metrics-grid">
        <div className="metric-card">
          <div className="metric-label">
            Techniques
          </div>

          <div className="metric-value">
            {metrics.total}
          </div>

          <div className="metric-detail">
            Registered ATT&CK techniques
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-label">
            Tactics
          </div>

          <div className="metric-value">
            {metrics.tactics}
          </div>

          <div className="metric-detail">
            Distinct tactic categories
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-label">
            Parent techniques
          </div>

          <div className="metric-value">
            {metrics.parentTechniques}
          </div>

          <div className="metric-detail">
            Top-level technique entries
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-label">
            Sub-techniques
          </div>

          <div className="metric-value">
            {metrics.subtechniques}
          </div>

          <div className="metric-detail">
            More specific behavior mappings
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="panel-header">
          <div className="row">
            <Target
              size={15}
              color="var(--accent)"
            />

            <span className="panel-title">
              Technique registry
            </span>
          </div>

          <span className="mono-muted">
            {filteredTechniques.length} of{" "}
            {techniques.length}
          </span>
        </div>

        <div className="panel-body">
          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "minmax(240px, 1fr) 220px",
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
                placeholder="Search technique, ID, tactic..."
                value={search}
                onChange={(event) =>
                  setSearch(event.target.value)
                }
              />
            </label>

            <label className="select-box">
              <Filter size={13} />

              <select
                value={tacticFilter}
                onChange={(event) =>
                  setTacticFilter(event.target.value)
                }
              >
                <option value="ALL">
                  All tactics
                </option>

                {tactics.map((tactic) => (
                  <option
                    value={tactic}
                    key={tactic}
                  >
                    {tactic}
                  </option>
                ))}
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
                  Unable to load ATT&CK techniques
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
                  void loadTechniques()
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
              <RefreshCw
                size={16}
                className="loading-icon"
              />

              <span>
                Loading ATT&CK technique registry...
              </span>
            </div>
          </div>
        ) : filteredTechniques.length === 0 ? (
          <div className="panel-body">
            <div className="empty-state">
              <div>
                <Crosshair size={20} />

                <div
                  className="empty-state-title"
                  style={{ marginTop: 10 }}
                >
                  No techniques found
                </div>

                <p className="empty-state-description">
                  {techniques.length === 0
                    ? "The ATT&CK technique registry is empty."
                    : "No techniques match the current filters."}
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Technique</th>
                  <th>Name</th>
                  <th>Tactic</th>
                  <th>Hierarchy</th>
                  <th>Internal ID</th>
                </tr>
              </thead>

              <tbody>
                {filteredTechniques.map(
                  (technique) => {
                    const isSubtechnique =
                      techniqueId(technique).includes(
                        ".",
                      );

                    return (
                      <tr key={technique.id}>
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
                              <Crosshair
                                size={14}
                                color="var(--accent)"
                              />
                            </div>

                            <span className="mono">
                              {techniqueId(technique)}
                            </span>
                          </div>
                        </td>

                        <td>
                          <div
                            style={{
                              fontWeight: 600,
                            }}
                          >
                            {technique.name}
                          </div>

                          {technique.description && (
                            <div
                              className="muted"
                              style={{
                                marginTop: 4,
                                maxWidth: 520,
                                lineHeight: 1.5,
                              }}
                            >
                              {technique.description}
                            </div>
                          )}
                        </td>

                        <td>
                          {technique.tactic ? (
                            <span className="badge badge-info">
                              {technique.tactic}
                            </span>
                          ) : (
                            <span className="mono-muted">
                              -
                            </span>
                          )}
                        </td>

                        <td>
                          <span
                            className={`badge ${
                              isSubtechnique
                                ? "badge-warning"
                                : "badge-success"
                            }`}
                          >
                            {isSubtechnique
                              ? "SUB-TECHNIQUE"
                              : "TECHNIQUE"}
                          </span>
                        </td>

                        <td className="mono-muted">
                          {shortId(technique.id)}
                        </td>
                      </tr>
                    );
                  },
                )}
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
            <BookOpen
              size={15}
              color="var(--accent)"
            />

            <span className="panel-title">
              ATT&CK integration
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
              <Crosshair
                size={16}
                color="var(--accent)"
              />

              <div>
                <strong>
                  Investigation mapping
                </strong>

                <p className="muted">
                  Investigations can be mapped to
                  observed ATT&CK techniques.
                </p>
              </div>
            </div>

            <div className="security-control">
              <Target
                size={16}
                color="var(--accent)"
              />

              <div>
                <strong>
                  Detection mapping
                </strong>

                <p className="muted">
                  Detection rule versions can carry
                  ATT&CK technique relationships.
                </p>
              </div>
            </div>

            <div className="security-control">
              <BookOpen
                size={16}
                color="var(--accent)"
              />

              <div>
                <strong>
                  Timeline mapping
                </strong>

                <p className="muted">
                  Individual timeline entries can be
                  associated with ATT&CK behavior.
                </p>
              </div>
            </div>
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
        <Shield size={12} />
        ATT&CK mappings are evidence-backed relationships,
        not standalone labels.
      </div>
    </div>
  );
}