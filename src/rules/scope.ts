/**
 * Scope Expansion Rules (SCOPE)
 * Rules for detecting capability and scope expansion
 * Note: These rules are primarily used in diff mode
 */

import { Finding, CapabilitySummary } from '../ir/types';
import { BaseRule } from './base';
import { RuleContext, RuleDefinition } from './types';
import { generateId } from '../utils/hash';

/**
 * SCOPE-001: Capability Expansion Between Versions
 * Diff detects new capabilities added
 */
export class CapabilityExpansionRule extends BaseRule {
  constructor() {
    super({
      id: 'SCOPE-001',
      group: 'scope',
      severity: 'high',
      title: 'Capability Expansion Between Versions',
      description:
        'New capabilities have been added, equivalent to permission escalation. This includes shell execution, network access, or sensitive file operations.',
      recommendation:
        'Review the capability expansion carefully. Ensure new capabilities are intentional and follow least-privilege principles.',
      tags: ['scope', 'expansion', 'diff', 'permissions'],
    });
  }

  evaluate(context: RuleContext): Finding[] {
    // This rule is primarily for diff mode
    // In scan mode, we report on detected high-risk capabilities
    const findings: Finding[] = [];
    const { document, capabilitySummary } = context;

    // Report if dynamic shell execution is detected (capability expansion indicator)
    if (capabilitySummary.shell_exec.dynamic_detected) {
      const finding = this.createFinding(
        document,
        { start_line: 1, end_line: 1 },
        'Dynamic shell execution capability detected. This is a high-risk capability.',
        [
          {
            kind: 'heuristic',
            value: 'shell_exec.dynamic_detected: true',
            confidence: 0.9,
          },
        ],
        0.9
      );
      findings.push(finding);
    }

    // Report if network + shell combination is detected
    if (
      capabilitySummary.network.outbound &&
      capabilitySummary.shell_exec.enabled &&
      capabilitySummary.network.fetches_executable
    ) {
      const finding = this.createFinding(
        document,
        { start_line: 1, end_line: 1 },
        'Remote code execution capability pattern detected: network + shell + executable fetch.',
        [
          {
            kind: 'heuristic',
            value: 'RCE pattern: network.outbound + shell_exec + fetches_executable',
            confidence: 0.95,
          },
        ],
        0.95
      );
      findings.push(finding);
    }

    return findings;
  }

  /**
   * Compare two capability summaries for expansion (used by diff engine)
   */
  static detectExpansion(
    base: CapabilitySummary,
    target: CapabilitySummary
  ): string[] {
    const expansions: string[] = [];

    // Shell execution expansion
    if (!base.shell_exec.enabled && target.shell_exec.enabled) {
      expansions.push('shell_exec: false → true');
    }
    if (!base.shell_exec.dynamic_detected && target.shell_exec.dynamic_detected) {
      expansions.push('shell_exec.dynamic: false → true');
    }

    // Network expansion
    if (!base.network.outbound && target.network.outbound) {
      expansions.push('network.outbound: false → true');
    }
    if (!base.network.inbound && target.network.inbound) {
      expansions.push('network.inbound: false → true');
    }
    if (!base.network.fetches_executable && target.network.fetches_executable) {
      expansions.push('network.fetches_executable: false → true');
    }

    // Secrets expansion
    const newSecretVars = target.secrets.env_vars_referenced.filter(
      v => !base.secrets.env_vars_referenced.includes(v)
    );
    if (newSecretVars.length > 0) {
      expansions.push(`secrets.env_vars: added ${newSecretVars.join(', ')}`);
    }

    if (!base.secrets.propagation_detected && target.secrets.propagation_detected) {
      expansions.push('secrets.propagation: false → true');
    }

    // Context expansion
    if (!base.contexts.has_hooks && target.contexts.has_hooks) {
      expansions.push('context.hooks: false → true');
    }
    if (!base.contexts.has_ci_context && target.contexts.has_ci_context) {
      expansions.push('context.ci: false → true');
    }

    // Sensitive paths expansion
    const newSensitivePaths = target.filesystem.touches_sensitive_paths.filter(
      p => !base.filesystem.touches_sensitive_paths.includes(p)
    );
    if (newSensitivePaths.length > 0) {
      expansions.push(`filesystem.sensitive_paths: added ${newSensitivePaths.join(', ')}`);
    }

    return expansions;
  }
}

/**
 * SCOPE-002: Write Scope Widening
 * File write paths have been broadened
 */
export class WriteScopeWideningRule extends BaseRule {
  constructor() {
    super({
      id: 'SCOPE-002',
      group: 'scope',
      severity: 'medium',
      title: 'Write Scope Widening',
      description:
        'File write access scope has been widened, potentially allowing writes to more locations.',
      recommendation:
        'Verify that expanded write scope is intentional. Keep write access as narrow as possible.',
      tags: ['scope', 'filesystem', 'write', 'diff'],
    });
  }

  evaluate(context: RuleContext): Finding[] {
    // This rule is primarily for diff mode
    // In scan mode, we check for broad write scopes
    const findings: Finding[] = [];
    const { document, capabilitySummary } = context;

    // Check for overly broad write patterns
    const broadPatterns = ['**/*', '**', '*', './'];
    const writePaths = capabilitySummary.filesystem.write;

    for (const path of writePaths) {
      if (broadPatterns.some(p => path === p || path.startsWith(p + '/'))) {
        const finding = this.createFinding(
          document,
          { start_line: 1, end_line: 1 },
          `Broad write scope detected: "${path}". This allows writes to many locations.`,
          [
            {
              kind: 'heuristic',
              value: `filesystem.write includes broad pattern: ${path}`,
              confidence: 0.85,
            },
          ],
          0.85
        );
        findings.push(finding);
        break; // Report once per document
      }
    }

    return findings;
  }

  /**
   * Compare two write scopes for widening (used by diff engine)
   */
  static detectWidening(
    baseWrites: string[],
    targetWrites: string[]
  ): { widened: boolean; changes: string[] } {
    const changes: string[] = [];
    let widened = false;

    // Check for new broad patterns
    const broadPatterns = ['**/*', '**', '*'];

    // Check if target has broad patterns that base didn't have
    for (const pattern of broadPatterns) {
      const targetHas = targetWrites.some(w => w === pattern || w.includes(pattern));
      const baseHad = baseWrites.some(w => w === pattern || w.includes(pattern));

      if (targetHas && !baseHad) {
        widened = true;
        changes.push(`Write scope widened to include: ${pattern}`);
      }
    }

    // Check for new write paths
    const newPaths = targetWrites.filter(p => !baseWrites.includes(p));
    if (newPaths.length > 0) {
      changes.push(`New write paths added: ${newPaths.join(', ')}`);
    }

    return { widened, changes };
  }
}

// Export all scope rules
export const scopeRules = [
  new CapabilityExpansionRule(),
  new WriteScopeWideningRule(),
];
