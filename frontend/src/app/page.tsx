import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  ArrowDown,
  ArrowRight,
  Bug,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Fingerprint,
  Network,
  ShieldAlert,
  Target,
  Terminal,
} from "lucide-react";

const metrics = [
  {
    label: "Open Alerts",
    value: "01",
    detail: "1 high severity",
    icon: AlertTriangle,
    tone: "warning",
  },
  {
    label: "Active Investigations",
    value: "01",
    detail: "1 in progress",
    icon: Bug,
    tone: "info",
  },
  {
    label: "Detection Rules",
    value: "01",
    detail: "1 active rule",
    icon: Target,
    tone: "success",
  },
  {
    label: "Events Ingested",
    value: "07",
    detail: "Latest simulation",
    icon: Activity,
    tone: "neutral",
  },
];

const timeline = [
  {
    time: "15:46:09",
    type: "AUTHENTICATION_FAILED",
    description: "Failed authentication attempt",
    source: "10.10.10.50",
    stage: "ACCESS ATTEMPT",
    tone: "neutral",
  },
  {
    time: "15:46:10",
    type: "AUTHENTICATION_FAILED",
    description: "Failed authentication attempt",
    source: "10.10.10.50",
    stage: "ACCESS ATTEMPT",
    tone: "neutral",
  },
  {
    time: "15:46:17",
    type: "AUTHENTICATION_FAILED",
    description: "Fifth failed authentication attempt",
    source: "10.10.10.50",
    stage: "BRUTE FORCE",
    tone: "warning",
  },
  {
    time: "15:46:21",
    type: "AUTHENTICATION_SUCCESS",
    description: "Successful authentication",
    source: "10.10.10.50",
    stage: "ACCOUNT ACCESS",
    tone: "success",
  },
  {
    time: "15:46:24",
    type: "PROCESS_EXECUTION",
    description: "Identity discovery command executed",
    source: "/bin/bash",
    stage: "DISCOVERY",
    tone: "danger",
  },
];

const attackPath = [
  {
    icon: Network,
    label: "Source",
    value: "10.10.10.50",
    detail: "Remote authentication origin",
  },
  {
    icon: Fingerprint,
    label: "Authentication",
    value: "5 failed attempts",
    detail: "Credential access pattern",
  },
  {
    icon: CheckCircle2,
    label: "Account access",
    value: "Successful login",
    detail: "Authentication succeeded",
  },
  {
    icon: Terminal,
    label: "Process",
    value: "/bin/bash → id",
    detail: "Identity discovery execution",
  },
];

const services = [
  {
    name: "API",
    status: "Operational",
    technology: "FastAPI",
  },
  {
    name: "Database",
    status: "Operational",
    technology: "PostgreSQL",
  },
  {
    name: "Detection Engine",
    status: "Active",
    technology: "1 active rule",
  },
  {
    name: "Telemetry Pipeline",
    status: "Operational",
    technology: "Normalized events",
  },
];

export default function DashboardPage() {
  return (
    <div className="dashboard-page">
      <section className="page-heading">
        <div>
          <span className="eyebrow">SECURITY OPERATIONS</span>

          <h1>Detection Overview</h1>

          <p>
            Monitor detections, alerts, investigations, and security events
            across the platform.
          </p>
        </div>

        <div className="page-heading-meta">
          <span className="live-indicator">
            <span className="status-indicator" />
            Live
          </span>

          <span className="meta-divider" />

          <span>Local environment</span>
        </div>
      </section>

      <section className="metrics-grid" aria-label="Security metrics">
        {metrics.map((metric) => {
          const Icon = metric.icon;

          return (
            <article className="metric-card" key={metric.label}>
              <div className={`metric-icon ${metric.tone}`}>
                <Icon size={17} strokeWidth={1.8} />
              </div>

              <div className="metric-content">
                <span className="metric-label">{metric.label}</span>
                <strong>{metric.value}</strong>
                <span className="metric-detail">{metric.detail}</span>
              </div>
            </article>
          );
        })}
      </section>

      <section className="dashboard-grid">
        <article className="panel timeline-panel">
          <div className="panel-header">
            <div>
              <span className="panel-kicker">ATTACK RECONSTRUCTION</span>
              <h2>Attack Timeline</h2>
            </div>

            <Link href="/events" className="text-button">
              View events
              <ArrowRight size={14} />
            </Link>
          </div>

          <div className="timeline-list">
            {timeline.map((event, index) => (
              <div
                className={`timeline-row timeline-row-${event.tone}`}
                key={`${event.time}-${index}`}
              >
                <div className="timeline-time">
                  <Clock3 size={13} />
                  <span>{event.time}</span>
                </div>

                <div className="timeline-marker">
                  <span />
                </div>

                <div className="timeline-event">
                  <div className="event-title-row">
                    <span className="event-title">{event.description}</span>

                    <span className="event-separator">·</span>

                    <span className="event-type">{event.type}</span>
                  </div>

                  <div className="event-context">
                    <span className="event-stage">{event.stage}</span>

                    <span className="event-source">{event.source}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="timeline-summary">
            <span>7 correlated events</span>
            <span>15:46:09 — 15:46:24</span>
            <span>15 sec observed window</span>
          </div>
        </article>

        <article className="panel detection-panel">
          <div className="panel-header">
            <div>
              <span className="panel-kicker">DETECTION INTELLIGENCE</span>
              <h2>Latest Detection</h2>
            </div>

            <span className="severity-badge high">HIGH</span>
          </div>

          <div className="detection-content">
            <div className="detection-status">
              <div className="detection-status-icon">
                <ShieldAlert size={20} />
              </div>

              <div>
                <span className="detection-status-label">MATCHED</span>

                <strong>Brute Force → Successful Login</strong>
              </div>
            </div>

            <p className="detection-description">
              Five failed authentication attempts were followed by a
              successful login and identity discovery process execution within
              the configured detection window.
            </p>

            <div className="detection-intelligence">
              <div className="detection-confidence">
                <div className="detection-confidence-header">
                  <span className="detection-confidence-label">
                    Detection confidence
                  </span>

                  <span className="detection-confidence-value">95%</span>
                </div>

                <div
                  className="detection-confidence-track"
                  role="progressbar"
                  aria-label="Detection confidence"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={95}
                >
                  <div
                    className="detection-confidence-fill"
                    style={{ width: "95%" }}
                  />
                </div>
              </div>

              <div className="detection-meta">
                <div>
                  <span>Window</span>
                  <strong>60 sec</strong>
                </div>

                <div>
                  <span>Events</span>
                  <strong>07</strong>
                </div>
              </div>
            </div>

            <div className="detection-rule">
              <span>Rule</span>
              <code>auth-bruteforce-success-process</code>
            </div>

            <Link
              href="/detections/2c6d8f52-0c7d-4a4e-b9f1-0d4d0d8b6c11"
              className="detection-link"
            >
              Inspect detection
              <ChevronRight size={14} />
            </Link>
          </div>
        </article>
      </section>

      <section className="dashboard-lower-grid">
        <article className="panel attack-path-panel">
          <div className="panel-header">
            <div>
              <span className="panel-kicker">CORRELATION</span>
              <h2>Attack Path</h2>
            </div>

            <span className="panel-context">15 sec sequence</span>
          </div>

          <div className="attack-flow">
            {attackPath.map((step, index) => {
              const Icon = step.icon;
              const isLast = index === attackPath.length - 1;

              return (
                <div
                  className={`attack-flow-step ${
                    index === attackPath.length - 1 ? "current" : ""
                  }`}
                  key={step.label}
                >
                  <div className="attack-flow-marker">
                    <Icon size={12} strokeWidth={1.8} />
                  </div>

                  <div className="attack-flow-content">
                    <span className="attack-flow-label">{step.label}</span>
                    <strong className="attack-flow-value">
                      {step.value}
                    </strong>
                    <span className="attack-flow-detail">{step.detail}</span>
                  </div>

                  {!isLast && (
                    <div className="attack-flow-connector">
                      <ArrowDown size={11} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </article>

        <article className="panel mitre-summary-panel">
          <div className="panel-header">
            <div>
              <span className="panel-kicker">ATT&CK MAPPING</span>
              <h2>Observed Techniques</h2>
            </div>

            <Link href="/mitre" className="text-button">
              Registry
              <ArrowRight size={14} />
            </Link>
          </div>

          <div className="mitre-techniques">
            <Link href="/mitre" className="mitre-technique">
              <div>
                <span className="mitre-id">T1110.001</span>
                <strong>Password Guessing</strong>
              </div>

              <ChevronRight size={14} />
            </Link>

            <Link href="/mitre" className="mitre-technique">
              <div>
                <span className="mitre-id">T1087.001</span>
                <strong>Local Account</strong>
              </div>

              <ChevronRight size={14} />
            </Link>
          </div>

          <div className="mitre-tactic">
            <span>TACTICS</span>
            <strong>Credential Access</strong>
            <span>Discovery</span>
          </div>
        </article>
      </section>

      <section className="panel operational-panel">
        <div className="panel-header">
          <div>
            <span className="panel-kicker">PLATFORM STATUS</span>
            <h2>Operational State</h2>
          </div>

          <span className="operational-status">
            <span className="status-indicator" />
            All core services available
          </span>
        </div>

        <div className="service-grid">
          {services.map((service) => (
            <div className="service-item" key={service.name}>
              <span className="service-name">{service.name}</span>

              <strong>{service.status}</strong>

              <small>{service.technology}</small>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}