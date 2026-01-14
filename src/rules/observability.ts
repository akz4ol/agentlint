/**
 * Observability & Audit Rules (OBS)
 * Rules for ensuring visibility and auditability
 */

import { Finding, CapabilityType } from '../ir/types';
import { BaseRule } from './base';
import { RuleContext } from './types';

/**
 * OBS-001: Missing Capability Declaration
 * Actions present without declared capabilities
 */
export class MissingCapabilityDeclarationRule extends BaseRule {
  constructor() {
    super({
      id: 'OBS-001',
      group: 'observability',
      severity: 'medium',
      title: 'Missing Capability Declaration',
      description:
        'Actions are present without corresponding capability declarations. This creates opaque behavior that is difficult to audit.',
      recommendation:
        'Declare all capabilities explicitly in the permission manifest. This improves visibility and enables policy enforcement.',
      tags: ['observability', 'capabilities', 'audit'],
    });
  }

  evaluate(context: RuleContext): Finding[] {
    const findings: Finding[] = [];
    const { document } = context;

    // Check for undeclared action types
    const actionTypes = new Set(document.actions.map(a => a.type));
    const declaredCapabilities = new Set(document.capabilities.map(c => c.type));

    // Map action types to expected capability types
    const actionToCapability: Record<string, string> = {
      shell_exec: 'shell_exec',
      network_call: 'network',
      file_write: 'filesystem',
      file_read: 'filesystem',
      git_operation: 'git',
    };

    for (const actionType of actionTypes) {
      const expectedCap = actionToCapability[actionType];
      if (expectedCap && !declaredCapabilities.has(expectedCap as CapabilityType)) {
        // Find an action of this type for location
        const action = document.actions.find(a => a.type === actionType);
        if (action) {
          const finding = this.createFinding(
            document,
            action.anchors,
            `Action "${actionType}" performed without declared capability.`,
            [
              {
                kind: 'heuristic',
                value: `Action type ${actionType} without ${expectedCap} capability`,
                confidence: 0.75,
              },
            ],
            0.75
          );
          findings.push(finding);
        }
      }
    }

    return findings;
  }
}

/**
 * OBS-002: No Permission Manifest
 * Agent config exists without explicit permission declaration
 */
export class NoPermissionManifestRule extends BaseRule {
  constructor() {
    super({
      id: 'OBS-002',
      group: 'observability',
      severity: 'low',
      title: 'No Permission Manifest',
      description:
        'Agent configuration exists without an explicit permission declaration. This encourages good hygiene and auditability.',
      recommendation:
        'Add an explicit permission manifest to the agent configuration. This documents expected capabilities and enables policy enforcement.',
      tags: ['observability', 'manifest', 'documentation'],
    });
  }

  evaluate(context: RuleContext): Finding[] {
    const findings: Finding[] = [];
    const { document } = context;

    // Check if document has any capabilities but no manifest
    if (document.capabilities.length > 0) {
      // Check if there's a permission declaration in instruction blocks
      const hasPermissionBlock = document.instruction_blocks.some(
        b =>
          b.text.toLowerCase().includes('permission') ||
          b.text.toLowerCase().includes('capability') ||
          b.text.toLowerCase().includes('allowed')
      );

      if (!hasPermissionBlock) {
        const finding = this.createFinding(
          document,
          { start_line: 1, end_line: 1 },
          'Agent configuration has capabilities but no explicit permission manifest.',
          [
            {
              kind: 'heuristic',
              value: 'No permission declaration found in document',
              confidence: 0.6,
            },
          ],
          0.6
        );
        findings.push(finding);
      }
    }

    return findings;
  }
}

// Export all observability rules
export const observabilityRules = [
  new MissingCapabilityDeclarationRule(),
  new NoPermissionManifestRule(),
];
