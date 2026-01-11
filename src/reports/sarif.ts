/**
 * SARIF Report Generator
 * SARIF v2.1.0 output for GitHub code scanning
 */

import { ReportData, ReportOptions, SarifReport, SarifRule, SarifResult, SarifArtifact } from './types';
import { Finding, Severity } from '../ir/types';
import { RuleEngine } from '../rules/engine';

// Package version
const TOOL_VERSION = '0.1.0';
const INFORMATION_URI = 'https://github.com/agentlint/agentlint';
const SARIF_SCHEMA = 'https://json.schemastore.org/sarif-2.1.0.json';

export class SarifReportGenerator {
  private options: ReportOptions;
  private ruleEngine: RuleEngine;

  constructor(options: ReportOptions) {
    this.options = options;
    this.ruleEngine = new RuleEngine();
  }

  generate(data: ReportData): string {
    const report = this.buildReport(data);
    return JSON.stringify(report, null, 2);
  }

  private buildReport(data: ReportData): SarifReport {
    // Get unique rule IDs from findings
    const ruleIds = new Set(data.findings.map(f => f.rule_id));

    // Build rules array
    const rules: SarifRule[] = [];
    for (const ruleId of ruleIds) {
      const definition = this.ruleEngine.getRuleDefinition(ruleId);
      if (definition) {
        rules.push(this.buildRule(definition));
      }
    }

    // Sort rules by ID for stability
    rules.sort((a, b) => a.id.localeCompare(b.id));

    // Build artifacts array
    const artifactPaths = new Set(data.findings.map(f => f.location.path));
    const artifacts: SarifArtifact[] = Array.from(artifactPaths)
      .sort()
      .map(path => ({
        location: { uri: path },
      }));

    // Build results array
    const results = data.findings.map(f => this.buildResult(f));

    // Sort results for stability
    results.sort((a, b) => {
      // Sort by level (error > warning > note)
      const levelOrder = { error: 0, warning: 1, note: 2, none: 3 };
      const levelDiff = levelOrder[a.level] - levelOrder[b.level];
      if (levelDiff !== 0) return levelDiff;

      // Then by location
      const aPath = a.locations[0]?.physicalLocation?.artifactLocation?.uri || '';
      const bPath = b.locations[0]?.physicalLocation?.artifactLocation?.uri || '';
      const pathDiff = aPath.localeCompare(bPath);
      if (pathDiff !== 0) return pathDiff;

      // Then by line
      const aLine = a.locations[0]?.physicalLocation?.region?.startLine || 0;
      const bLine = b.locations[0]?.physicalLocation?.region?.startLine || 0;
      const lineDiff = aLine - bLine;
      if (lineDiff !== 0) return lineDiff;

      // Then by rule ID
      return a.ruleId.localeCompare(b.ruleId);
    });

    const report: SarifReport = {
      version: '2.1.0',
      $schema: SARIF_SCHEMA,
      runs: [
        {
          tool: {
            driver: {
              name: 'AgentLint',
              version: TOOL_VERSION,
              informationUri: INFORMATION_URI,
              rules,
            },
          },
          artifacts,
          results,
        },
      ],
    };

    return report;
  }

  private buildRule(definition: {
    id: string;
    title: string;
    description: string;
    recommendation: string;
    group: string;
    severity: Severity;
    tags: string[];
  }): SarifRule {
    return {
      id: definition.id,
      name: definition.title,
      shortDescription: {
        text: definition.title,
      },
      fullDescription: {
        text: definition.description,
      },
      help: {
        text: definition.recommendation,
      },
      properties: {
        category: definition.group,
        severity: definition.severity,
        tags: ['agent-config', ...definition.tags],
      },
    };
  }

  private buildResult(finding: Finding): SarifResult {
    return {
      ruleId: finding.rule_id,
      level: this.severityToLevel(finding.severity),
      message: {
        text: finding.message,
      },
      locations: [
        {
          physicalLocation: {
            artifactLocation: {
              uri: finding.location.path,
            },
            region: {
              startLine: finding.location.start_line,
              endLine: finding.location.end_line,
            },
          },
        },
      ],
      properties: {
        severity: finding.severity,
        confidence: finding.confidence,
        evidence: finding.evidence[0]?.value || '',
        tags: finding.tags,
      },
    };
  }

  private severityToLevel(severity: Severity): 'error' | 'warning' | 'note' {
    switch (severity) {
      case 'high':
        return 'error';
      case 'medium':
        return 'warning';
      case 'low':
        return 'note';
    }
  }
}

/**
 * Generate SARIF diff report
 */
export function generateDiffSarifReport(data: ReportData): string {
  // For diff, we only include new findings in SARIF
  const diffFindings = data.diff?.new_findings || [];

  const diffData: ReportData = {
    ...data,
    findings: diffFindings,
  };

  const generator = new SarifReportGenerator({
    format: 'sarif',
    color: false,
    includeRecommendations: true,
    includePermissionManifest: false,
    includeIR: false,
    verbose: false,
  });

  return generator.generate(diffData);
}
