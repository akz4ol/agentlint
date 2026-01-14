/**
 * Filesystem Rules (FS)
 * Rules for detecting filesystem access risks
 */

import { Finding } from '../ir/types';
import { BaseRule } from './base';
import { RuleContext } from './types';

// Sensitive paths that should trigger alerts
const SENSITIVE_PATHS = [
  '.git/',
  '.git\\',
  '.github/workflows/',
  '.github\\workflows\\',
  '.env',
  '.ssh/',
  '.ssh\\',
  '~/.ssh/',
  'id_rsa',
  'id_ed25519',
  'credentials',
  'secrets',
  '.npmrc',
  '.pypirc',
  '.docker/config.json',
  '.kube/config',
  '.aws/credentials',
];

/**
 * FS-001: Unscoped Write Access
 * Agent writes to filesystem without a restricted path scope
 */
export class UnscopedWriteAccessRule extends BaseRule {
  constructor() {
    super({
      id: 'FS-001',
      group: 'filesystem',
      severity: 'high',
      title: 'Unscoped Write Access',
      description:
        'Agent has write access to the filesystem without a restricted path scope. This enables repo corruption, credential overwrite, and CI manipulation.',
      recommendation:
        'Restrict write access to specific directories (e.g., src/**, tests/**). Never allow unrestricted write access.',
      tags: ['filesystem', 'write', 'permissions'],
    });
  }

  evaluate(context: RuleContext): Finding[] {
    const findings: Finding[] = [];
    const { document, capabilitySummary, minConfidence } = context;

    // Check for unscoped write patterns in actions
    for (const action of document.actions) {
      if (action.type !== 'file_write') continue;

      const paths = action.filesystem?.paths || [];
      for (const path of paths) {
        if (this.isUnscopedPath(path)) {
          const confidence = action.evidence[0]?.confidence || 0.9;
          if (confidence < minConfidence) continue;

          const finding = this.createFinding(
            document,
            action.anchors,
            `Unscoped write access detected: "${path}". This allows writing to any file in the repository.`,
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

    // Check capability summary
    if (capabilitySummary.filesystem.write.some(p => this.isUnscopedPath(p))) {
      // Only add if no action-level finding exists
      if (findings.length === 0) {
        const finding = this.createFinding(
          document,
          { start_line: 1, end_line: 1 },
          'Document declares unscoped filesystem write access.',
          [
            {
              kind: 'heuristic',
              value: `Write paths: ${capabilitySummary.filesystem.write.join(', ')}`,
              confidence: 0.8,
            },
          ],
          0.8
        );
        findings.push(finding);
      }
    }

    return findings;
  }

  private isUnscopedPath(path: string): boolean {
    // Check for patterns that indicate unrestricted access
    const unscopedPatterns = [
      '**/*',
      '**',
      '*',
      './',
      '/',
      '..',
      '../',
    ];

    const normalizedPath = path.trim().toLowerCase();
    return unscopedPatterns.some(
      p => normalizedPath === p || normalizedPath.startsWith(p)
    );
  }
}

/**
 * FS-002: Sensitive Path Write
 * Writes to known sensitive locations
 */
export class SensitivePathWriteRule extends BaseRule {
  constructor() {
    super({
      id: 'FS-002',
      group: 'filesystem',
      severity: 'high',
      title: 'Sensitive Path Write',
      description:
        'Agent can write to known sensitive locations such as .git/, .github/workflows/, .env, or ~/.ssh/. This is a direct escalation or persistence vector.',
      recommendation:
        'Remove write access to sensitive paths. If necessary, require explicit user approval for each write operation.',
      tags: ['filesystem', 'sensitive', 'security'],
    });
  }

  evaluate(context: RuleContext): Finding[] {
    const findings: Finding[] = [];
    const { document, minConfidence } = context;

    for (const action of document.actions) {
      if (action.type !== 'file_write') continue;

      const sensitivePaths = action.filesystem?.sensitive_paths_touched || [];
      const paths = action.filesystem?.paths || [];

      // Check explicitly marked sensitive paths
      for (const sensitivePath of sensitivePaths) {
        const confidence = action.evidence[0]?.confidence || 0.9;
        if (confidence < minConfidence) continue;

        const finding = this.createFinding(
          document,
          action.anchors,
          `Write access to sensitive path: "${sensitivePath}". This could lead to privilege escalation or persistence.`,
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

      // Also check paths directly
      for (const path of paths) {
        if (this.isSensitivePath(path) && !sensitivePaths.includes(path)) {
          const confidence = action.evidence[0]?.confidence || 0.85;
          if (confidence < minConfidence) continue;

          const finding = this.createFinding(
            document,
            action.anchors,
            `Write access to sensitive path: "${path}".`,
            [
              {
                kind: 'heuristic',
                value: `Sensitive path pattern matched: ${path}`,
                confidence,
              },
            ],
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

  private isSensitivePath(path: string): boolean {
    const normalizedPath = path.toLowerCase();
    return SENSITIVE_PATHS.some(sp =>
      normalizedPath.includes(sp.toLowerCase())
    );
  }
}

/**
 * FS-003: Cross-Boundary Write
 * Agent writes outside declared project scope
 */
export class CrossBoundaryWriteRule extends BaseRule {
  constructor() {
    super({
      id: 'FS-003',
      group: 'filesystem',
      severity: 'medium',
      title: 'Cross-Boundary Write',
      description:
        'Agent can write outside the declared project scope, such as parent directories or sibling repositories.',
      recommendation:
        'Restrict write access to the project directory. Never allow writes to parent or sibling directories.',
      tags: ['filesystem', 'scope', 'boundary'],
    });
  }

  evaluate(context: RuleContext): Finding[] {
    const findings: Finding[] = [];
    const { document, minConfidence } = context;

    for (const action of document.actions) {
      if (action.type !== 'file_write') continue;

      const paths = action.filesystem?.paths || [];
      for (const path of paths) {
        if (this.isCrossBoundaryPath(path)) {
          const confidence = action.evidence[0]?.confidence || 0.8;
          if (confidence < minConfidence) continue;

          const finding = this.createFinding(
            document,
            action.anchors,
            `Cross-boundary write access detected: "${path}". This path is outside the project scope.`,
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

  private isCrossBoundaryPath(path: string): boolean {
    // Check for parent directory access or absolute paths outside project
    return (
      path.includes('../') ||
      path.includes('..\\') ||
      path.startsWith('/') ||
      path.startsWith('~') ||
      /^[A-Z]:\\/i.test(path)
    );
  }
}

// Export all filesystem rules
export const filesystemRules = [
  new UnscopedWriteAccessRule(),
  new SensitivePathWriteRule(),
  new CrossBoundaryWriteRule(),
];
