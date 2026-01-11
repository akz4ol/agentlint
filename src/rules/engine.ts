/**
 * Rule Engine
 * Orchestrates rule evaluation and finding generation
 */

import {
  AgentDocument,
  Finding,
  CapabilitySummary,
  Severity,
} from '../ir/types';
import { Rule, RuleContext, RuleDefinition, RuleEngineOptions, RuleGroup } from './types';
import { executionRules } from './execution';
import { filesystemRules } from './filesystem';
import { networkRules } from './network';
import { secretRules } from './secrets';
import { hookRules } from './hook';
import { instructionRules } from './instruction';
import { scopeRules } from './scope';
import { observabilityRules } from './observability';

/**
 * Rule Engine - evaluates all rules against documents
 */
export class RuleEngine {
  private rules: Rule[];
  private options: RuleEngineOptions;
  private ruleMap: Map<string, Rule>;

  constructor(options: Partial<RuleEngineOptions> = {}) {
    this.options = {
      minConfidence: options.minConfidence ?? 0.6,
      disabledRules: options.disabledRules ?? [],
      severityOverrides: options.severityOverrides ?? {},
    };

    // Collect all rules
    this.rules = [
      ...executionRules,
      ...filesystemRules,
      ...networkRules,
      ...secretRules,
      ...hookRules,
      ...instructionRules,
      ...scopeRules,
      ...observabilityRules,
    ];

    // Build rule map for quick lookup
    this.ruleMap = new Map();
    for (const rule of this.rules) {
      this.ruleMap.set(rule.getDefinition().id, rule);
    }
  }

  /**
   * Get all available rules
   */
  getAllRules(): RuleDefinition[] {
    return this.rules.map(r => r.getDefinition());
  }

  /**
   * Get enabled rules (after applying disabled list)
   */
  getEnabledRules(): RuleDefinition[] {
    return this.rules
      .filter(r => !this.options.disabledRules.includes(r.getDefinition().id))
      .map(r => r.getDefinition());
  }

  /**
   * Get a rule by ID
   */
  getRule(ruleId: string): Rule | undefined {
    return this.ruleMap.get(ruleId);
  }

  /**
   * Get rule definition by ID
   */
  getRuleDefinition(ruleId: string): RuleDefinition | undefined {
    const rule = this.ruleMap.get(ruleId);
    return rule?.getDefinition();
  }

  /**
   * Get rules by group
   */
  getRulesByGroup(group: RuleGroup): RuleDefinition[] {
    return this.rules
      .filter(r => r.getDefinition().group === group)
      .map(r => r.getDefinition());
  }

  /**
   * Evaluate all rules against a single document
   */
  evaluateDocument(
    document: AgentDocument,
    allDocuments: AgentDocument[],
    capabilitySummary: CapabilitySummary
  ): Finding[] {
    const findings: Finding[] = [];

    const context: RuleContext = {
      document,
      allDocuments,
      capabilitySummary,
      minConfidence: this.options.minConfidence,
    };

    for (const rule of this.rules) {
      const definition = rule.getDefinition();

      // Skip disabled rules
      if (this.options.disabledRules.includes(definition.id)) {
        continue;
      }

      try {
        const ruleFindings = rule.evaluate(context);

        // Apply severity overrides and filter by confidence
        for (const finding of ruleFindings) {
          // Apply severity override if configured
          if (this.options.severityOverrides[definition.id]) {
            finding.severity = this.options.severityOverrides[definition.id];
          }

          // Filter by confidence threshold
          if (finding.confidence >= this.options.minConfidence) {
            findings.push(finding);
          }
        }
      } catch (error) {
        // Log but don't fail on individual rule errors
        console.error(`Error evaluating rule ${definition.id}:`, error);
      }
    }

    return findings;
  }

  /**
   * Evaluate all rules against multiple documents
   */
  evaluateAll(
    documents: AgentDocument[],
    capabilitySummary: CapabilitySummary
  ): Finding[] {
    const findings: Finding[] = [];

    for (const document of documents) {
      const docFindings = this.evaluateDocument(
        document,
        documents,
        capabilitySummary
      );
      findings.push(...docFindings);
    }

    // Sort findings: severity (high first), then path, then line
    return this.sortFindings(findings);
  }

  /**
   * Sort findings by severity, path, and line number
   */
  private sortFindings(findings: Finding[]): Finding[] {
    const severityOrder: Record<Severity, number> = {
      high: 0,
      medium: 1,
      low: 2,
    };

    return findings.sort((a, b) => {
      // Sort by severity first
      const severityDiff = severityOrder[a.severity] - severityOrder[b.severity];
      if (severityDiff !== 0) return severityDiff;

      // Then by path
      const pathDiff = a.location.path.localeCompare(b.location.path);
      if (pathDiff !== 0) return pathDiff;

      // Then by line number
      const lineDiff = a.location.start_line - b.location.start_line;
      if (lineDiff !== 0) return lineDiff;

      // Finally by rule ID for stability
      return a.rule_id.localeCompare(b.rule_id);
    });
  }

  /**
   * Count findings by severity
   */
  countBySeverity(findings: Finding[]): Record<Severity, number> {
    const counts: Record<Severity, number> = {
      high: 0,
      medium: 0,
      low: 0,
    };

    for (const finding of findings) {
      counts[finding.severity]++;
    }

    return counts;
  }

  /**
   * Filter findings by minimum severity
   */
  filterBySeverity(findings: Finding[], minSeverity: Severity): Finding[] {
    const severityLevel: Record<Severity, number> = {
      high: 3,
      medium: 2,
      low: 1,
    };

    const minLevel = severityLevel[minSeverity];
    return findings.filter(f => severityLevel[f.severity] >= minLevel);
  }

  /**
   * Check if any finding meets or exceeds the threshold
   */
  hasFindings(findings: Finding[], threshold: Severity | 'none'): boolean {
    if (threshold === 'none') return false;
    return this.filterBySeverity(findings, threshold).length > 0;
  }
}

// Export a default instance
export const defaultRuleEngine = new RuleEngine();
