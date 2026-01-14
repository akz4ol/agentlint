/**
 * Report generation types
 */

import {
  AgentLintReport,
  Finding,
  CapabilitySummary,
  PermissionManifest,
  DocumentSummary,
  DiffResult,
  ScanStatus,
} from '../ir/types';

export type ReportFormat = 'text' | 'json' | 'sarif';

export interface ReportOptions {
  format: ReportFormat;
  color: boolean;
  includeRecommendations: boolean;
  includePermissionManifest: boolean;
  includeIR: boolean;
  verbose: boolean;
}

export interface ReportData {
  report: AgentLintReport;
  findings: Finding[];
  capabilitySummary: CapabilitySummary;
  recommendedPermissions: PermissionManifest;
  documents: DocumentSummary[];
  diff?: DiffResult;
  status: ScanStatus;
  exitCode: number;
}

/**
 * SARIF types for GitHub code scanning
 */
export interface SarifReport {
  version: '2.1.0';
  $schema: string;
  runs: SarifRun[];
}

export interface SarifRun {
  tool: {
    driver: SarifDriver;
  };
  artifacts: SarifArtifact[];
  results: SarifResult[];
}

export interface SarifDriver {
  name: string;
  version: string;
  informationUri: string;
  rules: SarifRule[];
}

export interface SarifRule {
  id: string;
  name: string;
  shortDescription: { text: string };
  fullDescription: { text: string };
  help: { text: string };
  properties: {
    category: string;
    severity: string;
    tags: string[];
  };
}

export interface SarifArtifact {
  location: {
    uri: string;
  };
}

export interface SarifResult {
  ruleId: string;
  level: 'error' | 'warning' | 'note' | 'none';
  message: { text: string };
  locations: SarifLocation[];
  properties?: Record<string, unknown>;
}

export interface SarifLocation {
  physicalLocation: {
    artifactLocation: {
      uri: string;
    };
    region: {
      startLine: number;
      endLine: number;
    };
  };
}
