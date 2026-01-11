/**
 * Execution Rules (EXEC)
 * Rules for detecting shell execution risks
 */

import { Finding } from '../ir/types';
import { BaseRule } from './base';
import { RuleContext, RuleDefinition } from './types';

/**
 * EXEC-001: Dynamic Shell Execution
 * Detects shell execution where the command is dynamically constructed or fetched
 */
export class DynamicShellExecutionRule extends BaseRule {
  constructor() {
    super({
      id: 'EXEC-001',
      group: 'execution',
      severity: 'high',
      title: 'Dynamic Shell Execution',
      description:
        'Detects shell execution where the command is dynamically constructed or fetched. This includes patterns like curl|bash, wget|sh, and eval with variables.',
      recommendation:
        'Replace with fixed commands or disable shell access. Use pinned, verified installers instead of fetching scripts from the network.',
      tags: ['rce', 'supply-chain', 'dynamic-execution'],
    });
  }

  evaluate(context: RuleContext): Finding[] {
    const findings: Finding[] = [];
    const { document, minConfidence } = context;

    for (const action of document.actions) {
      if (action.type !== 'shell_exec') continue;
      if (!action.shell?.dynamic) continue;

      const confidence = action.evidence[0]?.confidence || 0.9;
      if (confidence < minConfidence) continue;

      const patterns = action.shell.patterns || [];
      let message = 'Dynamic shell execution detected.';

      if (patterns.includes('curl|bash') || patterns.includes('wget|bash')) {
        message = 'Remote code execution risk: curl|bash or wget|bash pattern detected.';
      } else if (patterns.includes('eval')) {
        message = 'Dynamic shell execution via eval detected.';
      } else if (patterns.includes('variable_interpolation')) {
        message = 'Shell command with variable interpolation detected.';
      }

      const finding = this.createFinding(
        document,
        action.anchors,
        message,
        action.evidence,
        confidence
      );

      // Add related action info
      finding.related_actions.push({
        action_type: action.type,
        context: action.context,
        summary: action.summary,
        anchors: action.anchors,
      });

      findings.push(finding);
    }

    return findings;
  }
}

/**
 * EXEC-002: Shell Execution in Non-Interactive Context
 * Shell commands executed inside hooks or auto-triggered contexts
 */
export class ShellInNonInteractiveRule extends BaseRule {
  constructor() {
    super({
      id: 'EXEC-002',
      group: 'execution',
      severity: 'high',
      title: 'Shell Execution in Non-Interactive Context',
      description:
        'Shell commands executed inside hooks or auto-triggered contexts. Users do not explicitly approve these actions at runtime.',
      recommendation:
        'Move shell execution to interactive contexts where user approval is required, or remove automatic hook execution.',
      tags: ['rce', 'hook', 'automation'],
    });
  }

  evaluate(context: RuleContext): Finding[] {
    const findings: Finding[] = [];
    const { document, minConfidence } = context;

    // Only applies to hook context
    if (document.context_profile.primary !== 'hook') {
      return findings;
    }

    for (const action of document.actions) {
      if (action.type !== 'shell_exec') continue;

      const confidence = action.evidence[0]?.confidence || 0.9;
      if (confidence < minConfidence) continue;

      const finding = this.createFinding(
        document,
        action.anchors,
        `Shell execution in hook context: ${action.summary}. Users do not explicitly approve hook actions.`,
        action.evidence,
        confidence
      );

      finding.related_actions.push({
        action_type: action.type,
        context: action.context,
        summary: action.summary,
        anchors: action.anchors,
      });

      findings.push(finding);
    }

    return findings;
  }
}

/**
 * EXEC-003: Broad Shell Capability Declaration
 * Shell execution allowed without scope restriction
 */
export class BroadShellCapabilityRule extends BaseRule {
  constructor() {
    super({
      id: 'EXEC-003',
      group: 'execution',
      severity: 'medium',
      title: 'Broad Shell Capability Declaration',
      description:
        'Shell execution is allowed without command scope restriction. This enables arbitrary command execution.',
      recommendation:
        'Define an explicit command allowlist in the permission manifest, or disable shell execution.',
      tags: ['shell', 'permissions', 'least-privilege'],
    });
  }

  evaluate(context: RuleContext): Finding[] {
    const findings: Finding[] = [];
    const { document, capabilitySummary } = context;

    // Check if shell execution is enabled without restrictions
    if (!capabilitySummary.shell_exec.enabled) {
      return findings;
    }

    // Check each capability for unrestricted shell access
    for (const cap of document.capabilities) {
      if (cap.type !== 'shell_exec') continue;

      const hasAllowlist =
        cap.scope.shell_exec?.allowed_commands &&
        cap.scope.shell_exec.allowed_commands.length > 0;

      if (!hasAllowlist) {
        const finding = this.createFinding(
          document,
          { start_line: 1, end_line: 1 },
          'Shell execution capability declared without command restrictions.',
          [
            {
              kind: 'heuristic',
              value: 'shell_exec: enabled without allowlist',
              confidence: 0.8,
            },
          ],
          0.8
        );

        findings.push(finding);
        break; // Only report once per document
      }
    }

    return findings;
  }
}

// Export all execution rules
export const executionRules = [
  new DynamicShellExecutionRule(),
  new ShellInNonInteractiveRule(),
  new BroadShellCapabilityRule(),
];
