/**
 * Network Rules (NET)
 * Rules for detecting network access risks
 */

import { Finding } from '../ir/types';
import { BaseRule } from './base';
import { RuleContext, RuleDefinition } from './types';

/**
 * NET-001: Undeclared Network Access
 * Network calls detected without explicit declaration
 */
export class UndeclaredNetworkAccessRule extends BaseRule {
  constructor() {
    super({
      id: 'NET-001',
      group: 'network',
      severity: 'high',
      title: 'Undeclared Network Access',
      description:
        'Network calls detected without explicit capability declaration. This poses a silent exfiltration risk.',
      recommendation:
        'Explicitly declare network access in the permission manifest, or disable network access if not required.',
      tags: ['network', 'exfiltration', 'undeclared'],
    });
  }

  evaluate(context: RuleContext): Finding[] {
    const findings: Finding[] = [];
    const { document, capabilitySummary, minConfidence } = context;

    // Check if network capability is declared
    const hasNetworkCapability =
      capabilitySummary.network.outbound || capabilitySummary.network.inbound;

    for (const action of document.actions) {
      if (action.type !== 'network_call') continue;

      const confidence = action.evidence[0]?.confidence || 0.9;
      if (confidence < minConfidence) continue;

      // If network actions exist but capability is not declared
      const urls = action.network?.urls || [];
      const domains = action.network?.domains || [];

      // Check if this specific domain/URL is allowed
      const isAllowed =
        hasNetworkCapability &&
        domains.every(d =>
          capabilitySummary.network.allowed_domains.includes(d)
        );

      if (!hasNetworkCapability || !isAllowed) {
        const finding = this.createFinding(
          document,
          action.anchors,
          `Network access to ${urls.join(', ') || domains.join(', ')} detected without explicit declaration.`,
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

    return findings;
  }
}

/**
 * NET-002: Remote Script Fetch
 * Network call that fetches executable content
 */
export class RemoteScriptFetchRule extends BaseRule {
  constructor() {
    super({
      id: 'NET-002',
      group: 'network',
      severity: 'high',
      title: 'Remote Script Fetch',
      description:
        'Network call that fetches executable content such as scripts or binaries. This is a major supply-chain risk.',
      recommendation:
        'Avoid fetching executable content from the network. Use pinned, verified artifacts from trusted sources.',
      tags: ['network', 'executable', 'supply-chain'],
    });
  }

  evaluate(context: RuleContext): Finding[] {
    const findings: Finding[] = [];
    const { document, minConfidence } = context;

    for (const action of document.actions) {
      if (action.type !== 'network_call') continue;
      if (!action.network?.fetches_executable) continue;

      const confidence = action.evidence[0]?.confidence || 0.95;
      if (confidence < minConfidence) continue;

      const urls = action.network?.urls || [];
      const finding = this.createFinding(
        document,
        action.anchors,
        `Remote executable content fetched from: ${urls.join(', ')}. This is a supply-chain attack vector.`,
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
 * NET-003: Broad Network Access
 * Outbound network access without domain restriction
 */
export class BroadNetworkAccessRule extends BaseRule {
  constructor() {
    super({
      id: 'NET-003',
      group: 'network',
      severity: 'medium',
      title: 'Broad Network Access',
      description:
        'Outbound network access is enabled without domain restrictions. This allows data exfiltration to any destination.',
      recommendation:
        'Restrict network access to specific, trusted domains using an allowlist.',
      tags: ['network', 'outbound', 'least-privilege'],
    });
  }

  evaluate(context: RuleContext): Finding[] {
    const findings: Finding[] = [];
    const { document, capabilitySummary } = context;

    // Check if outbound network is enabled without domain restrictions
    if (!capabilitySummary.network.outbound) {
      return findings;
    }

    const hasRestrictions =
      capabilitySummary.network.allowed_domains.length > 0;

    if (!hasRestrictions) {
      // Find the first network action for location reference
      const networkAction = document.actions.find(
        a => a.type === 'network_call'
      );

      const anchors = networkAction?.anchors || { start_line: 1, end_line: 1 };

      const finding = this.createFinding(
        document,
        anchors,
        'Outbound network access enabled without domain restrictions.',
        [
          {
            kind: 'heuristic',
            value: 'network.outbound: true without allowed_domains',
            confidence: 0.8,
          },
        ],
        0.8
      );

      findings.push(finding);
    }

    return findings;
  }
}

// Export all network rules
export const networkRules = [
  new UndeclaredNetworkAccessRule(),
  new RemoteScriptFetchRule(),
  new BroadNetworkAccessRule(),
];
