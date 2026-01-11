/**
 * Instruction Integrity Rules (INST)
 * Rules for detecting instruction override and bypass patterns
 */

import { Finding } from '../ir/types';
import { BaseRule } from './base';
import { RuleContext, RuleDefinition } from './types';

// Patterns that indicate instruction override attempts
const OVERRIDE_PATTERNS = [
  /ignore\s+(?:all\s+)?(?:previous\s+)?(?:instructions?|rules?)/i,
  /disregard\s+(?:all\s+)?(?:previous\s+)?(?:rules?|instructions?)/i,
  /forget\s+(?:all\s+)?(?:previous\s+)?(?:instructions?|rules?)/i,
  /override\s+(?:all\s+)?(?:rules?|restrictions?|safeguards?)/i,
  /bypass\s+(?:all\s+)?(?:safety\s+)?(?:rules?|restrictions?|safeguards?)/i,
  /disable\s+(?:all\s+)?(?:safety\s+)?(?:safeguards?|restrictions?)/i,
  /rewrite\s+(?:your\s+)?(?:rules?|instructions?)/i,
  /new\s+system\s+prompt/i,
  /you\s+are\s+now\s+(?:a\s+)?(?:new|different)/i,
  /pretend\s+(?:you\s+are|that)/i,
  /act\s+as\s+if\s+(?:you\s+have\s+no|there\s+are\s+no)/i,
  /from\s+now\s+on,?\s+(?:ignore|forget|disregard)/i,
];

// Patterns that indicate self-modification
const SELF_MODIFY_PATTERNS = [
  /(?:modify|edit|change|update|rewrite)\s+(?:your(?:self)?|this\s+)?(?:rules?|config|instructions?|settings?)/i,
  /add\s+(?:new\s+)?(?:rules?|instructions?)\s+to\s+(?:your(?:self)?|this)/i,
  /(?:delete|remove)\s+(?:existing\s+)?(?:rules?|restrictions?)/i,
  /reconfigure\s+(?:your(?:self)?|the\s+agent)/i,
  /change\s+(?:your\s+)?(?:behavior|capabilities)/i,
];

/**
 * INST-001: Instruction Override Patterns
 * Patterns that instruct the agent to ignore rules or disable safeguards
 */
export class InstructionOverrideRule extends BaseRule {
  constructor() {
    super({
      id: 'INST-001',
      group: 'instruction',
      severity: 'high',
      title: 'Instruction Override Patterns',
      description:
        'Patterns that instruct the agent to ignore previous rules, rewrite governance, or disable safeguards. This is a governance bypass attempt.',
      recommendation:
        'Remove instruction override patterns. Agent configurations should not attempt to bypass safety measures.',
      tags: ['instruction', 'override', 'governance', 'jailbreak'],
    });
  }

  evaluate(context: RuleContext): Finding[] {
    const findings: Finding[] = [];
    const { document, minConfidence } = context;

    // Check instruction blocks
    for (const block of document.instruction_blocks) {
      for (const pattern of OVERRIDE_PATTERNS) {
        const match = block.text.match(pattern);
        if (match) {
          const finding = this.createFinding(
            document,
            block.anchors,
            `Instruction override pattern detected: "${match[0]}"`,
            [
              {
                kind: 'regex',
                value: match[0],
                confidence: 0.95,
              },
            ],
            0.95
          );

          findings.push(finding);
          break; // One finding per block
        }
      }
    }

    // Check actions for override patterns (from parser detection)
    for (const action of document.actions) {
      if (action.type !== 'unknown') continue;
      if (!action.summary.includes('Instruction override')) continue;

      const confidence = action.evidence[0]?.confidence || 0.9;
      if (confidence < minConfidence) continue;

      // Avoid duplicate findings
      const isDuplicate = findings.some(
        f =>
          f.location.start_line === action.anchors.start_line &&
          f.location.path === document.path
      );

      if (!isDuplicate) {
        const finding = this.createFinding(
          document,
          action.anchors,
          `Instruction override pattern detected in action.`,
          action.evidence,
          confidence
        );

        findings.push(finding);
      }
    }

    return findings;
  }
}

/**
 * INST-002: Self-Modifying Rules
 * Agent instructed to modify its own configuration or rules
 */
export class SelfModifyingRulesRule extends BaseRule {
  constructor() {
    super({
      id: 'INST-002',
      group: 'instruction',
      severity: 'high',
      title: 'Self-Modifying Rules',
      description:
        'Agent is instructed to modify its own configuration, rules, or behavior. This creates unpredictable governance risks.',
      recommendation:
        'Agent configurations should be immutable during execution. Remove self-modification instructions.',
      tags: ['instruction', 'self-modify', 'governance'],
    });
  }

  evaluate(context: RuleContext): Finding[] {
    const findings: Finding[] = [];
    const { document, minConfidence } = context;

    // Check instruction blocks for self-modification patterns
    for (const block of document.instruction_blocks) {
      for (const pattern of SELF_MODIFY_PATTERNS) {
        const match = block.text.match(pattern);
        if (match) {
          const finding = this.createFinding(
            document,
            block.anchors,
            `Self-modification pattern detected: "${match[0]}"`,
            [
              {
                kind: 'regex',
                value: match[0],
                confidence: 0.9,
              },
            ],
            0.9
          );

          findings.push(finding);
          break; // One finding per block
        }
      }
    }

    // Check if document has actions that write to agent config locations
    const agentConfigPaths = [
      '.claude/',
      '.cursorrules',
      'CLAUDE.md',
      'AGENTS.md',
    ];

    for (const action of document.actions) {
      if (action.type !== 'file_write') continue;

      const paths = action.filesystem?.paths || [];
      for (const path of paths) {
        const normalizedPath = path.toLowerCase();
        if (agentConfigPaths.some(p => normalizedPath.includes(p))) {
          const confidence = action.evidence[0]?.confidence || 0.85;
          if (confidence < minConfidence) continue;

          const finding = this.createFinding(
            document,
            action.anchors,
            `Self-modification detected: writes to agent configuration path "${path}"`,
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
      }
    }

    return findings;
  }
}

// Export all instruction rules
export const instructionRules = [
  new InstructionOverrideRule(),
  new SelfModifyingRulesRule(),
];
