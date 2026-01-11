/**
 * Text Report Generator
 * Human-readable console output
 */

import { ReportData, ReportOptions } from './types';
import { Severity, Finding } from '../ir/types';

// ANSI color codes (when color is enabled)
const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  green: '\x1b[32m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
};

export class TextReportGenerator {
  private options: ReportOptions;
  private colorEnabled: boolean;

  constructor(options: ReportOptions) {
    this.options = options;
    this.colorEnabled = options.color;
  }

  generate(data: ReportData): string {
    const lines: string[] = [];

    // Header
    lines.push(this.header(data));
    lines.push('');

    // Summary
    lines.push(this.summary(data));
    lines.push('');

    // Findings
    if (data.findings.length > 0) {
      lines.push(this.findingsSection(data.findings));
      lines.push('');
    } else {
      lines.push(this.color('No findings detected.', 'green'));
      lines.push('');
    }

    // Capability Summary (if verbose)
    if (this.options.verbose) {
      lines.push(this.capabilitySummary(data));
      lines.push('');
    }

    // Recommended Permissions
    if (this.options.includePermissionManifest && data.findings.length > 0) {
      lines.push(this.recommendedPermissions(data));
      lines.push('');
    }

    // Status line
    lines.push(this.statusLine(data));

    return lines.join('\n');
  }

  private header(data: ReportData): string {
    const scanRoot = data.report.inputs.scan_root;
    return this.color(`AgentLint scan: ${scanRoot}`, 'bold');
  }

  private summary(data: ReportData): string {
    const lines: string[] = [];
    const { summary } = data.report;

    // Documents scanned
    const docBreakdown: string[] = [];
    const toolCounts: Record<string, number> = {};

    for (const doc of data.documents) {
      toolCounts[doc.tool_family] = (toolCounts[doc.tool_family] || 0) + 1;
    }

    for (const [tool, count] of Object.entries(toolCounts)) {
      if (count > 0) {
        docBreakdown.push(`${tool}=${count}`);
      }
    }

    lines.push(
      `Parsed: ${summary.documents_scanned} documents (${docBreakdown.join(', ')})`
    );

    // Context info
    const contextParts: string[] = [];
    if (summary.contexts.has_hooks) {
      contextParts.push('hooks detected');
    }
    if (summary.contexts.has_ci_context) {
      contextParts.push('ci-risk paths touched');
    }

    if (contextParts.length > 0) {
      lines.push(`Context: ${contextParts.join(', ')}`);
    }

    // Parse status
    if (summary.parse.partial > 0 || summary.parse.failed > 0) {
      lines.push(
        this.color(
          `Parse status: ${summary.parse.ok} ok, ${summary.parse.partial} partial, ${summary.parse.failed} failed`,
          summary.parse.failed > 0 ? 'yellow' : 'dim'
        )
      );
    }

    return lines.join('\n');
  }

  private findingsSection(findings: Finding[]): string {
    const lines: string[] = [];
    lines.push(this.color('Findings:', 'bold'));

    for (const finding of findings) {
      lines.push(this.formatFinding(finding));
    }

    return lines.join('\n');
  }

  private formatFinding(finding: Finding): string {
    const lines: string[] = [];

    // Severity and rule
    const severityLabel = this.formatSeverity(finding.severity);
    lines.push(`  ${severityLabel} ${finding.rule_id} ${finding.title}`);

    // Location
    const location = `${finding.location.path}:${finding.location.start_line}-${finding.location.end_line}`;
    lines.push(`    ${this.color(location, 'cyan')}`);

    // Message
    lines.push(`    ${finding.message}`);

    // Evidence (first one)
    if (finding.evidence.length > 0) {
      const evidence = finding.evidence[0].value;
      const truncated =
        evidence.length > 80 ? evidence.substring(0, 77) + '...' : evidence;
      lines.push(`    ${this.color(`Evidence: "${truncated}"`, 'dim')}`);
    }

    // Recommendation (if enabled)
    if (this.options.includeRecommendations) {
      lines.push(`    ${this.color(`Recommendation: ${finding.recommendation}`, 'dim')}`);
    }

    return lines.join('\n');
  }

  private formatSeverity(severity: Severity): string {
    switch (severity) {
      case 'high':
        return this.color('HIGH ', 'red');
      case 'medium':
        return this.color('MED  ', 'yellow');
      case 'low':
        return this.color('LOW  ', 'dim');
    }
  }

  private capabilitySummary(data: ReportData): string {
    const lines: string[] = [];
    const caps = data.capabilitySummary;

    lines.push(this.color('Capabilities detected:', 'bold'));

    if (caps.shell_exec.enabled) {
      lines.push(
        `  - Shell execution: ${caps.shell_exec.dynamic_detected ? this.color('DYNAMIC', 'red') : 'enabled'}`
      );
      if (caps.shell_exec.examples.length > 0) {
        lines.push(`    Examples: ${caps.shell_exec.examples.slice(0, 3).join(', ')}`);
      }
    }

    if (caps.network.outbound || caps.network.inbound) {
      const netParts: string[] = [];
      if (caps.network.outbound) netParts.push('outbound');
      if (caps.network.inbound) netParts.push('inbound');
      lines.push(`  - Network: ${netParts.join(', ')}`);
      if (caps.network.allowed_domains.length > 0) {
        lines.push(`    Domains: ${caps.network.allowed_domains.join(', ')}`);
      }
      if (caps.network.fetches_executable) {
        lines.push(`    ${this.color('Fetches executable content', 'red')}`);
      }
    }

    if (caps.filesystem.write.length > 0) {
      lines.push(`  - Filesystem write: ${caps.filesystem.write.join(', ')}`);
    }

    if (caps.filesystem.touches_sensitive_paths.length > 0) {
      lines.push(
        `  - ${this.color('Sensitive paths:', 'yellow')} ${caps.filesystem.touches_sensitive_paths.join(', ')}`
      );
    }

    if (caps.secrets.env_vars_referenced.length > 0) {
      lines.push(`  - Secrets referenced: ${caps.secrets.env_vars_referenced.join(', ')}`);
    }

    if (caps.git.ops.length > 0) {
      lines.push(`  - Git operations: ${caps.git.ops.join(', ')}`);
    }

    return lines.join('\n');
  }

  private recommendedPermissions(data: ReportData): string {
    const lines: string[] = [];
    const perms = data.recommendedPermissions.permissions;

    lines.push(this.color('Recommended permissions:', 'bold'));

    if (perms.filesystem.read.length > 0) {
      lines.push(`  filesystem.read: ${JSON.stringify(perms.filesystem.read)}`);
    }
    if (perms.filesystem.write.length > 0) {
      lines.push(`  filesystem.write: ${JSON.stringify(perms.filesystem.write)}`);
    }
    lines.push(`  shell_exec.enabled: ${perms.shell_exec.enabled}`);
    if (perms.shell_exec.allowed_commands.length > 0) {
      lines.push(`  shell_exec.allowed_commands: ${JSON.stringify(perms.shell_exec.allowed_commands)}`);
    }
    lines.push(`  network.outbound: ${perms.network.outbound}`);
    if (perms.network.allowed_domains.length > 0) {
      lines.push(`  network.allowed_domains: ${JSON.stringify(perms.network.allowed_domains)}`);
    }

    return lines.join('\n');
  }

  private statusLine(data: ReportData): string {
    const counts = data.report.summary.counts_by_severity;
    const countParts: string[] = [];

    if (counts.high > 0) {
      countParts.push(this.color(`${counts.high} high`, 'red'));
    }
    if (counts.medium > 0) {
      countParts.push(this.color(`${counts.medium} medium`, 'yellow'));
    }
    if (counts.low > 0) {
      countParts.push(`${counts.low} low`);
    }

    const statusText =
      data.status === 'pass'
        ? this.color('PASS', 'green')
        : data.status === 'warn'
        ? this.color('WARN', 'yellow')
        : this.color('FAIL', 'red');

    if (countParts.length > 0) {
      return `Status: ${statusText} (${countParts.join(', ')})`;
    } else {
      return `Status: ${statusText}`;
    }
  }

  private color(text: string, color: keyof typeof colors): string {
    if (!this.colorEnabled) {
      return text;
    }
    return `${colors[color]}${text}${colors.reset}`;
  }
}

/**
 * Generate text diff report
 */
export function generateDiffTextReport(data: ReportData, options: ReportOptions): string {
  const lines: string[] = [];
  const diff = data.diff;

  if (!diff) {
    return 'No diff data available.';
  }

  const colorEnabled = options.color;
  const c = (text: string, color: keyof typeof colors): string => {
    return colorEnabled ? `${colors[color]}${text}${colors.reset}` : text;
  };

  // Header
  lines.push(c(`AgentLint diff: ${diff.base.ref} → ${diff.target.ref}`, 'bold'));
  lines.push('');

  // Changes
  if (diff.changes.length > 0) {
    lines.push(c('Behavioral changes:', 'bold'));
    for (const change of diff.changes) {
      const severity = change.severity === 'high' ? c('HIGH', 'red') :
                       change.severity === 'medium' ? c('MED ', 'yellow') :
                       'LOW ';
      lines.push(`  ${severity} ${change.type}`);
      lines.push(`    ${change.message}`);
    }
    lines.push('');
  }

  // New findings
  if (diff.new_findings.length > 0) {
    lines.push(c('New findings introduced:', 'bold'));
    for (const finding of diff.new_findings) {
      const severity = finding.severity === 'high' ? c('HIGH', 'red') :
                       finding.severity === 'medium' ? c('MED ', 'yellow') :
                       'LOW ';
      lines.push(`  ${severity} ${finding.rule_id} ${finding.title}`);
      lines.push(`    ${finding.location.path}:${finding.location.start_line}-${finding.location.end_line}`);
    }
    lines.push('');
  }

  // Resolved findings
  if (diff.resolved_findings.length > 0) {
    lines.push(c('Findings resolved:', 'green'));
    for (const finding of diff.resolved_findings) {
      lines.push(`  ${finding.rule_id} ${finding.title}`);
    }
    lines.push('');
  }

  // Status
  const statusText = diff.summary.status === 'pass' ? c('PASS', 'green') :
                     diff.summary.status === 'warn' ? c('WARN', 'yellow') :
                     c('FAIL', 'red');

  const reason = diff.summary.capability_expansion ? 'capability expansion detected' :
                 diff.summary.new_high_findings > 0 ? `${diff.summary.new_high_findings} new high findings` :
                 '';

  lines.push(`Status: ${statusText}${reason ? ` (${reason})` : ''}`);

  return lines.join('\n');
}
