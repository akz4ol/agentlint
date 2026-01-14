/**
 * JSON Report Generator
 * Machine-readable output for CI/CD and dashboards
 */

import { ReportData, ReportOptions } from './types';
import { AgentLintReport, REPORT_VERSION, IR_SCHEMA_VERSION } from '../ir/types';
import * as os from 'os';

// Package version (would normally come from package.json)
const TOOL_VERSION = '0.1.0';

export class JsonReportGenerator {
  private options: ReportOptions;

  constructor(options: ReportOptions) {
    this.options = options;
  }

  generate(data: ReportData): string {
    const report = this.buildReport(data);
    return JSON.stringify(report, null, 2);
  }

  private buildReport(data: ReportData): AgentLintReport {
    const report: AgentLintReport = {
      report_version: REPORT_VERSION,
      schema_version: IR_SCHEMA_VERSION,
      generated_at: new Date().toISOString(),
      tool: {
        name: 'agentlint',
        version: TOOL_VERSION,
        build: {
          os: os.platform(),
          arch: os.arch(),
        },
      },
      inputs: data.report.inputs,
      policy: data.report.policy,
      summary: data.report.summary,
      documents: data.documents,
      capability_summary: data.capabilitySummary,
      recommended_permissions: data.recommendedPermissions,
      findings: data.findings,
      diff: data.diff || null,
      errors: data.report.errors || [],
      annotations: data.report.annotations || {},
    };

    // Remove IR data if not requested
    if (!this.options.includeIR) {
      // The documents array already contains summaries, not full IR
    }

    // Remove recommendations if not requested
    if (!this.options.includeRecommendations) {
      for (const finding of report.findings) {
        finding.recommendation = '';
      }
    }

    // Remove permission manifest if not requested
    if (!this.options.includePermissionManifest) {
      delete (report as Partial<AgentLintReport>).recommended_permissions;
    }

    return report;
  }
}

/**
 * Generate JSON diff report
 */
export function generateDiffJsonReport(data: ReportData): string {
  const report = {
    report_version: REPORT_VERSION,
    schema_version: IR_SCHEMA_VERSION,
    generated_at: new Date().toISOString(),
    tool: {
      name: 'agentlint',
      version: TOOL_VERSION,
      build: {
        os: os.platform(),
        arch: os.arch(),
      },
    },
    diff: data.diff,
    summary: {
      status: data.diff?.summary.status || 'pass',
      exit_code: data.diff?.summary.exit_code || 0,
      capability_expansion: data.diff?.summary.capability_expansion || false,
      new_high_findings: data.diff?.summary.new_high_findings || 0,
      changes_count: data.diff?.changes.length || 0,
      new_findings_count: data.diff?.new_findings.length || 0,
      resolved_findings_count: data.diff?.resolved_findings.length || 0,
    },
  };

  return JSON.stringify(report, null, 2);
}
