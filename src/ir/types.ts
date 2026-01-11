/**
 * AgentLint Internal IR Schema v0.1
 * Core type definitions for the intermediate representation
 */

// Schema version constant
export const IR_SCHEMA_VERSION = 'agentlint.ir.v0.1';
export const REPORT_VERSION = 'agentlint.report.v1.0';
export const PERMISSIONS_VERSION = 'agentlint.permissions.v0.1';

// Enums
export type Severity = 'low' | 'medium' | 'high';
export type ToolFamily = 'claude' | 'cursor' | 'generic' | 'unknown';
export type DocType = 'skill' | 'agent' | 'hook' | 'rules' | 'memory' | 'unknown';
export type DocFormat = 'markdown' | 'text' | 'shell' | 'json' | 'yaml' | 'unknown';
export type ParseStatus = 'ok' | 'partial' | 'failed';
export type ContextType = 'interactive' | 'hook' | 'ci' | 'unknown';
export type TriggerType = 'on_edit' | 'pre_commit' | 'post_edit' | 'on_pr' | 'scheduled' | 'manual' | 'unknown';
export type ActionType = 'shell_exec' | 'file_read' | 'file_write' | 'network_call' | 'git_operation' | 'tool_integration' | 'unknown';
export type EvidenceKind = 'substring' | 'regex' | 'heuristic';
export type NetworkDirection = 'outbound' | 'inbound' | 'unknown';
export type FilesystemOperation = 'read' | 'write' | 'delete' | 'chmod' | 'unknown';
export type GitOperation = 'commit' | 'push' | 'checkout' | 'merge' | 'tag' | 'rebase' | 'unknown';
export type LinkKind = 'url' | 'file_ref' | 'mcp_server' | 'unknown';
export type CapabilityType = 'filesystem' | 'shell_exec' | 'network' | 'secrets' | 'git' | 'ci_modification' | 'unknown';
export type ScanStatus = 'pass' | 'warn' | 'fail';

// Source Reference
export interface SourceRef {
  source_id: string;
  repo_url?: string;
  repo_host?: string;
  git_ref?: string;
  scan_root: string;
  collected_at: string;
  hashes: {
    algo: string;
    tree_hash?: string;
    file_hashes?: Record<string, string>;
  };
}

// Parse result
export interface ParseResult {
  status: ParseStatus;
  confidence: number;
  errors: string[];
  notes: string[];
}

// Anchors for line references
export interface Anchors {
  start_line: number;
  end_line: number;
}

// Instruction block
export interface InstructionBlock {
  block_id: string;
  kind: 'rule' | 'guideline' | 'command' | 'narrative' | 'unknown';
  text: string;
  anchors: Anchors;
}

// Context trigger
export interface ContextTrigger {
  type: TriggerType;
  details?: string;
}

// Context profile
export interface ContextProfile {
  primary: ContextType;
  triggers: ContextTrigger[];
  requires_user_confirmation?: boolean;
  runs_in_privileged_env?: boolean;
}

// Evidence
export interface Evidence {
  kind: EvidenceKind;
  value: string;
  confidence: number;
}

// Shell action details
export interface ShellDetails {
  command?: string;
  dynamic?: boolean;
  patterns?: string[];
  allowlist_hint?: string[];
}

// Filesystem action details
export interface FilesystemDetails {
  operation: FilesystemOperation;
  paths: string[];
  sensitive_paths_touched?: string[];
}

// Network action details
export interface NetworkDetails {
  direction: NetworkDirection;
  domains?: string[];
  urls?: string[];
  protocols?: string[];
  fetches_executable?: boolean;
}

// Git action details
export interface GitDetails {
  operation: GitOperation;
  ref?: string;
  remote?: string;
}

// Secrets action details
export interface SecretsDetails {
  reads_env_vars?: string[];
  reads_files?: string[];
  propagates_to?: ('shell' | 'network' | 'file' | 'unknown')[];
}

// Action
export interface Action {
  action_id: string;
  type: ActionType;
  context: ContextType;
  summary: string;
  anchors: Anchors;
  shell?: ShellDetails;
  filesystem?: FilesystemDetails;
  network?: NetworkDetails;
  git?: GitDetails;
  secrets?: SecretsDetails;
  evidence: Evidence[];
}

// Document link
export interface DocumentLink {
  kind: LinkKind;
  target: string;
  anchors: Anchors;
}

// Agent Document
export interface AgentDocument {
  doc_id: string;
  source_id: string;
  path: string;
  tool_family: ToolFamily;
  doc_type: DocType;
  format: DocFormat;
  hash: {
    algo: string;
    value: string;
  };
  parse: ParseResult;
  declared_intents?: string[];
  instruction_blocks: InstructionBlock[];
  actions: Action[];
  capabilities: Capability[];
  context_profile: ContextProfile;
  links: DocumentLink[];
}

// Capability scope
export interface CapabilityScope {
  filesystem?: {
    read?: string[];
    write?: string[];
    delete?: string[];
  };
  shell_exec?: {
    enabled?: boolean;
    allowed_commands?: string[];
    deny_patterns?: string[];
  };
  network?: {
    outbound?: boolean;
    inbound?: boolean;
    allowed_domains?: string[];
    allowed_urls?: string[];
  };
  secrets?: {
    env_vars?: string[];
    files?: string[];
  };
  git?: {
    allowed_ops?: string[];
    allowed_remotes?: string[];
  };
}

// Capability
export interface Capability {
  cap_id: string;
  type: CapabilityType;
  scope: CapabilityScope;
  derived_from_actions: string[];
  confidence: number;
}

// Capability Summary
export interface CapabilitySummary {
  filesystem: {
    read: string[];
    write: string[];
    touches_sensitive_paths: string[];
  };
  shell_exec: {
    enabled: boolean;
    dynamic_detected: boolean;
    examples: string[];
  };
  network: {
    outbound: boolean;
    inbound: boolean;
    allowed_domains: string[];
    fetches_executable: boolean;
  };
  secrets: {
    env_vars_referenced: string[];
    files_referenced: string[];
    propagation_detected: boolean;
  };
  git: {
    ops: string[];
  };
  contexts: {
    has_hooks: boolean;
    has_ci_context: boolean;
  };
}

// Permission Manifest
export interface PermissionManifest {
  manifest_version: string;
  permissions: {
    filesystem: {
      read: string[];
      write: string[];
      delete: string[];
    };
    shell_exec: {
      enabled: boolean;
      allowed_commands: string[];
    };
    network: {
      outbound: boolean;
      allowed_domains: string[];
    };
    secrets: {
      env_vars: string[];
      files: string[];
    };
    git: {
      allowed_ops: string[];
    };
  };
}

// Finding location
export interface FindingLocation {
  path: string;
  start_line: number;
  end_line: number;
}

// Related action (for findings)
export interface RelatedAction {
  action_type: ActionType;
  context: ContextType;
  summary: string;
  anchors: Anchors;
}

// Finding fingerprints
export interface FindingFingerprints {
  stable: string;
  location: string;
  content: string;
}

// Finding
export interface Finding {
  finding_id: string;
  rule_id: string;
  group: string;
  severity: Severity;
  title: string;
  description: string;
  message: string;
  recommendation: string;
  confidence: number;
  tags: string[];
  location: FindingLocation;
  evidence: Evidence[];
  related_actions: RelatedAction[];
  fingerprints: FindingFingerprints;
}

// Document Summary (for reports)
export interface DocumentSummary {
  doc_id: string;
  path: string;
  tool_family: ToolFamily;
  doc_type: DocType;
  format: DocFormat;
  hash: string;
  parse: ParseResult;
  context_profile: ContextProfile;
  action_counts: {
    shell_exec: number;
    file_write: number;
    network_call: number;
    secrets: number;
  };
}

// Tool info
export interface ToolInfo {
  name: string;
  version: string;
  commit?: string;
  build: {
    os: string;
    arch: string;
  };
}

// Scan inputs
export interface ScanInputs {
  scan_root: string;
  sources: SourceRef[];
  include: string[];
  exclude: string[];
  tool_mode: 'auto' | 'claude' | 'cursor';
}

// Policy config
export interface PolicyConfig {
  ci_mode: boolean;
  fail_on: Severity | 'none';
  warn_on: Severity | 'none';
  min_confidence: number;
  rules_disabled: string[];
  severity_overrides: Record<string, Severity>;
}

// Report summary
export interface ReportSummary {
  documents_scanned: number;
  files_matched: number;
  parse: {
    ok: number;
    partial: number;
    failed: number;
  };
  contexts: {
    has_hooks: boolean;
    has_ci_context: boolean;
  };
  counts_by_severity: {
    high: number;
    medium: number;
    low: number;
  };
  status: ScanStatus;
  exit_code: number;
}

// Tool error
export interface ToolError {
  code: 'CONFIG_INVALID' | 'PARSE_FAILED' | 'INTERNAL_ERROR';
  message: string;
  details?: Record<string, unknown>;
}

// Diff change
export interface DiffChange {
  change_id: string;
  type: string;
  severity: Severity;
  message: string;
  details: Record<string, unknown>;
}

// Diff result
export interface DiffResult {
  base: {
    ref: string;
    tree_hash: string;
  };
  target: {
    ref: string;
    tree_hash: string;
  };
  summary: {
    capability_expansion: boolean;
    new_high_findings: number;
    status: ScanStatus;
    exit_code: number;
  };
  changes: DiffChange[];
  new_findings: Finding[];
  resolved_findings: Finding[];
}

// Agent Config Bundle (top-level IR object)
export interface AgentConfigBundle {
  schema_version: string;
  bundle_id: string;
  generated_at: string;
  sources: SourceRef[];
  documents: AgentDocument[];
  capability_summary: CapabilitySummary;
  recommended_permissions?: PermissionManifest;
  annotations?: Record<string, unknown>;
}

// Full Report
export interface AgentLintReport {
  report_version: string;
  schema_version: string;
  generated_at: string;
  tool: ToolInfo;
  inputs: ScanInputs;
  policy: PolicyConfig;
  summary: ReportSummary;
  documents: DocumentSummary[];
  capability_summary: CapabilitySummary;
  recommended_permissions: PermissionManifest;
  findings: Finding[];
  diff: DiffResult | null;
  errors: ToolError[];
  annotations: Record<string, unknown>;
}
