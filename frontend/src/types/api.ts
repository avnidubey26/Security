export type UUID = string;

export type ApiErrorDetail =
  | string
  | {
      loc?: Array<string | number>;
      msg?: string;
      type?: string;
    };

export interface ApiErrorResponse {
  detail: ApiErrorDetail;
  request_id?: string;
}

export interface HealthResponse {
  status: string;
  service: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
}

export interface Scenario {
  id: UUID;
  name: string;
  slug: string;
  description?: string | null;
  scenario_type?: string | null;
  execution_mode?: string | null;
  runner_key?: string | null;
  parameter_schema?: Record<string, unknown> | null;
  allowed_platforms?: string[] | null;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface ScenarioRun {
  id: UUID;
  scenario_id: UUID;
  status: string;
  parameters?: Record<string, unknown> | null;
  started_at?: string | null;
  completed_at?: string | null;
  created_at?: string;
  error_message?: string | null;
}

export interface SecurityEvent {
  id: UUID;
  raw_telemetry_id?: UUID | null;
  timestamp: string;
  event_type: string;
  source: string;
  source_user?: string | null;
  source_ip?: string | null;
  destination_ip?: string | null;
  destination_port?: number | null;
  process?: string | null;
  parent_process?: string | null;
  action?: string | null;
  status?: string | null;
  hostname?: string | null;
  resource?: string | null;
  metadata_json?: Record<string, unknown> | null;
}

export type DetectionRuleStatus = "DRAFT" | "ACTIVE" | "DISABLED";

export interface DetectionRule {
  id: UUID;
  name: string;
  slug: string;
  description?: string | null;
  status: DetectionRuleStatus | string;
  created_at?: string;
  updated_at?: string;
}

export interface DetectionRuleVersion {
  id: UUID;
  detection_rule_id: UUID;
  version: number;
  format: string;
  definition: Record<string, unknown>;
  severity: string;
  confidence: number;
  is_active: boolean;
  created_at?: string;
  activated_at?: string | null;
}

export interface DetectionResult {
  id: UUID;
  detection_rule_version_id: UUID;
  evaluation_type: string;
  matched: boolean;
  evaluated_at: string;
  explanation?: string | null;
  matched_event_ids: UUID[];
  context?: Record<string, unknown> | null;
  created_at?: string;
}

export type AlertStatus =
  | "NEW"
  | "ACKNOWLEDGED"
  | "RESOLVED"
  | "DISMISSED";

export interface Alert {
  id: UUID;
  detection_result_id: UUID;
  detection_rule_version_id: UUID;
  title: string;
  severity: string;
  confidence: number;
  status: AlertStatus | string;
  explanation?: string | null;
  context?: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
  acknowledged_at?: string | null;
  resolved_at?: string | null;
}

export interface AlertEvent {
  id: UUID;
  alert_id: UUID;
  security_event_id: UUID;
  relationship_type: string;
  created_at: string;
}

export type InvestigationStatus =
  | "OPEN"
  | "IN_PROGRESS"
  | "CONTAINED"
  | "CLOSED";

export type InvestigationPriority = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface Investigation {
  id: UUID;
  title: string;
  description?: string | null;
  status: InvestigationStatus | string;
  priority: InvestigationPriority | string;
  assigned_to?: UUID | string | null;
  started_at?: string | null;
  closed_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface InvestigationAlert {
  investigation_id: UUID;
  alert_id: UUID;
  relationship_type: string;
  created_at: string;
}

export interface InvestigationEvent {
  investigation_id: UUID;
  security_event_id: UUID;
  relationship_type: string;
  created_at: string;
}

export interface InvestigationNote {
  id: UUID;
  investigation_id: UUID;
  author_id?: UUID | string | null;
  content: string;
  created_at: string;
  updated_at?: string;
}

export interface InvestigationFinding {
  id: UUID;
  investigation_id: UUID;
  finding_type: string;
  title: string;
  description?: string | null;
  author_id?: UUID | string | null;
  created_at: string;
  updated_at?: string;
}

export interface TimelineEntry {
  id: UUID;
  investigation_id: UUID;
  security_event_id: UUID;
  entry_type: string;
  title: string;
  description?: string | null;
  occurred_at: string;
  sequence_number: number;
  source?: string | null;
  context?: Record<string, unknown> | null;
  created_at: string;
}

export interface Evidence {
  id: UUID;
  investigation_id: UUID;
  evidence_type: string;
  source_type: string;
  source_id: UUID;
  title?: string | null;
  description?: string | null;
  snapshot?: Record<string, unknown> | null;
  provenance?: Record<string, unknown> | null;
  integrity_hash: string;
  collected_by: UUID | string;
  collected_at: string;
  created_at: string;
}

export type IncidentStatus =
  | "OPEN"
  | "CONTAINED"
  | "RESOLVED"
  | "CLOSED"
  | "FALSE_POSITIVE";

export interface Incident {
  id: UUID;
  incident_number: string;
  investigation_id: UUID;
  title: string;
  description?: string | null;
  severity: string;
  status: IncidentStatus | string;
  assigned_to?: UUID | string | null;
  detected_at?: string | null;
  contained_at?: string | null;
  resolved_at?: string | null;
  closed_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface MitreTechnique {
  id: UUID;
  technique_id: string;
  name: string;
  description?: string | null;
  tactic?: string | null;
  parent_technique_id?: UUID | null;
}

export interface InvestigationMitreMapping {
  investigation_id: UUID;
  technique_id: UUID;
  mapping_type?: string | null;
  confidence?: number | null;
  rationale?: string | null;
}

export interface AuditLog {
  id: UUID;
  actor_id?: UUID | string | null;
  action: string;
  resource_type: string;
  resource_id?: UUID | null;
  metadata?: Record<string, unknown> | null;
  created_at: string;
}

export interface ReportDocument {
  investigation: Record<string, unknown>;
  incident: Record<string, unknown> | null;
  detections: Record<string, unknown>[];
  alerts: Record<string, unknown>[];
  events: Record<string, unknown>[];
  timeline: Record<string, unknown>[];
  findings: Record<string, unknown>[];
  notes: Record<string, unknown>[];
  evidence: Record<string, unknown>[];
  mitre_techniques: Record<string, unknown>[];
  generated_at: string;
}