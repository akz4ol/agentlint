/**
 * Hook & Automation Rules (HOOK)
 * Rules for detecting risks in automated hooks
 */

import { Finding } from '../ir/types';
import { BaseRule } from './base';
import { RuleContext } from './types';

/**
 * HOOK-001: Auto-Triggered Hook with Side Effects
 * Hooks that run automatically and perform side effects
 */
export class AutoTriggeredHookRule extends BaseRule {
  constructor() {
    super({
      id: 'HOOK-001',
      group: 'hook',
      severity: 'high',
      title: 'Auto-Triggered Hook with Side Effects',
      description:
        'Hooks that run automatically and perform shell execution, file writes, or network calls. Users do not explicitly approve hooks.',
      recommendation:
        'Remove side effects from automatic hooks, or convert to interactive skills that require user approval.',
      tags: ['hook', 'automation', 'side-effects'],
    });
  }

  evaluate(context: RuleContext): Finding[] {
    const findings: Finding[] = [];
    const { document, minConfidence } = context;

    // Only applies to hook context
    if (document.doc_type !== 'hook') {
      return findings;
    }

    // Check if the hook has side effects
    const sideEffectActions = document.actions.filter(
      a =>
        a.type === 'shell_exec' ||
        a.type === 'file_write' ||
        a.type === 'network_call'
    );

    if (sideEffectActions.length === 0) {
      return findings;
    }

    // Check if hook is auto-triggered (not manual)
    const isAutoTriggered = document.context_profile.triggers.some(
      t => t.type !== 'manual' && t.type !== 'unknown'
    );

    if (!isAutoTriggered && document.context_profile.triggers.length > 0) {
      return findings;
    }

    // Report the hook
    const triggerTypes = document.context_profile.triggers
      .map(t => t.type)
      .join(', ');

    for (const action of sideEffectActions) {
      const confidence = action.evidence[0]?.confidence || 0.9;
      if (confidence < minConfidence) continue;

      const finding = this.createFinding(
        document,
        action.anchors,
        `Auto-triggered hook (${triggerTypes}) performs ${action.type}: ${action.summary}`,
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
 * HOOK-002: Hidden Hook Activation
 * Hooks defined without clear documentation or discoverability
 */
export class HiddenHookActivationRule extends BaseRule {
  constructor() {
    super({
      id: 'HOOK-002',
      group: 'hook',
      severity: 'medium',
      title: 'Hidden Hook Activation',
      description:
        'Hooks defined without clear documentation or discoverability. This makes it difficult to audit agent behavior.',
      recommendation:
        'Document all hooks clearly. Include trigger conditions and expected behavior in comments or documentation.',
      tags: ['hook', 'documentation', 'discoverability'],
    });
  }

  evaluate(context: RuleContext): Finding[] {
    const findings: Finding[] = [];
    const { document } = context;

    // Only applies to hook context
    if (document.doc_type !== 'hook') {
      return findings;
    }

    // Check if hook has triggers defined
    const hasClearTriggers = document.context_profile.triggers.some(
      t => t.type !== 'unknown'
    );

    // Check if hook has documentation/comments
    const hasDocumentation =
      document.instruction_blocks.length > 0 ||
      (document.declared_intents && document.declared_intents.length > 0);

    if (!hasClearTriggers && !hasDocumentation) {
      const finding = this.createFinding(
        document,
        { start_line: 1, end_line: 1 },
        'Hook lacks clear trigger documentation or discoverability.',
        [
          {
            kind: 'heuristic',
            value: 'No trigger type or documentation detected',
            confidence: 0.7,
          },
        ],
        0.7
      );

      findings.push(finding);
    }

    return findings;
  }
}

// Export all hook rules
export const hookRules = [
  new AutoTriggeredHookRule(),
  new HiddenHookActivationRule(),
];
