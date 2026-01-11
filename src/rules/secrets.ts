/**
 * Credential & Secret Rules (SEC)
 * Rules for detecting credential and secret access risks
 */

import { Finding } from '../ir/types';
import { BaseRule } from './base';
import { RuleContext, RuleDefinition } from './types';

// Known secret environment variables
const KNOWN_SECRET_VARS = [
  'GITHUB_TOKEN',
  'GH_TOKEN',
  'GITLAB_TOKEN',
  'AWS_SECRET_ACCESS_KEY',
  'AWS_ACCESS_KEY_ID',
  'AWS_SESSION_TOKEN',
  'AZURE_CLIENT_SECRET',
  'AZURE_CLIENT_ID',
  'AZURE_TENANT_ID',
  'AZURE_SUBSCRIPTION_ID',
  'GOOGLE_APPLICATION_CREDENTIALS',
  'GCP_SERVICE_ACCOUNT',
  'GCLOUD_SERVICE_KEY',
  'API_KEY',
  'API_SECRET',
  'SECRET_KEY',
  'PRIVATE_KEY',
  'DATABASE_PASSWORD',
  'DATABASE_URL',
  'DB_PASSWORD',
  'DB_HOST',
  'REDIS_PASSWORD',
  'MONGODB_URI',
  'PASSWORD',
  'TOKEN',
  'NPM_TOKEN',
  'NPM_AUTH_TOKEN',
  'PYPI_TOKEN',
  'PYPI_PASSWORD',
  'DOCKER_PASSWORD',
  'DOCKER_AUTH',
  'SSH_PRIVATE_KEY',
  'SSH_KEY',
  'SLACK_TOKEN',
  'SLACK_WEBHOOK',
  'DISCORD_TOKEN',
  'SENDGRID_API_KEY',
  'STRIPE_SECRET_KEY',
  'TWILIO_AUTH_TOKEN',
  'OPENAI_API_KEY',
  'ANTHROPIC_API_KEY',
  'ENCRYPTION_KEY',
  'JWT_SECRET',
  'SESSION_SECRET',
  'COOKIE_SECRET',
];

// Secret file patterns
const SECRET_FILE_PATTERNS = [
  '.env',
  '.env.local',
  '.env.production',
  '.env.development',
  'credentials.json',
  'secrets.json',
  'service-account.json',
  '.npmrc',
  '.pypirc',
  '.netrc',
  '.docker/config.json',
  '.aws/credentials',
  '.kube/config',
  'id_rsa',
  'id_ed25519',
  'id_ecdsa',
  '.ssh/config',
];

/**
 * SEC-001: Environment Secret Reference
 * References to known secret environment variables
 */
export class EnvironmentSecretReferenceRule extends BaseRule {
  constructor() {
    super({
      id: 'SEC-001',
      group: 'secrets',
      severity: 'high',
      title: 'Environment Secret Reference',
      description:
        'References to known secret environment variables such as GITHUB_TOKEN, AWS_SECRET_ACCESS_KEY, or API_KEY. Agents should not touch secrets by default.',
      recommendation:
        'Remove secret references from agent configurations. Use secure secret management practices.',
      tags: ['secrets', 'credentials', 'environment'],
    });
  }

  evaluate(context: RuleContext): Finding[] {
    const findings: Finding[] = [];
    const { document, minConfidence } = context;

    for (const action of document.actions) {
      const secretVars = action.secrets?.reads_env_vars || [];

      for (const varName of secretVars) {
        if (this.isKnownSecretVar(varName)) {
          const confidence = action.evidence[0]?.confidence || 0.9;
          if (confidence < minConfidence) continue;

          const finding = this.createFinding(
            document,
            action.anchors,
            `Reference to secret environment variable: $${varName}. Agents should not access secrets directly.`,
            [
              {
                kind: 'regex',
                value: `$${varName}`,
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

    // Also check capability summary
    for (const varName of context.capabilitySummary.secrets.env_vars_referenced) {
      if (
        this.isKnownSecretVar(varName) &&
        !findings.some(f => f.message.includes(varName))
      ) {
        const finding = this.createFinding(
          document,
          { start_line: 1, end_line: 1 },
          `Reference to secret environment variable: $${varName}.`,
          [
            {
              kind: 'heuristic',
              value: `Secret variable referenced: ${varName}`,
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

  private isKnownSecretVar(varName: string): boolean {
    const upperVar = varName.toUpperCase();
    return KNOWN_SECRET_VARS.some(
      secret => upperVar === secret || upperVar.includes(secret)
    );
  }
}

/**
 * SEC-002: Implicit Secret Access
 * Access to .env or config files likely containing secrets
 */
export class ImplicitSecretAccessRule extends BaseRule {
  constructor() {
    super({
      id: 'SEC-002',
      group: 'secrets',
      severity: 'medium',
      title: 'Implicit Secret Access',
      description:
        'Access to .env files or configuration files that commonly contain secrets.',
      recommendation:
        'Avoid accessing secret-containing files. Use environment variables or secure secret stores instead.',
      tags: ['secrets', 'files', 'configuration'],
    });
  }

  evaluate(context: RuleContext): Finding[] {
    const findings: Finding[] = [];
    const { document, minConfidence } = context;

    // Check actions for file access to secret files
    for (const action of document.actions) {
      const secretFiles = action.secrets?.reads_files || [];
      const paths = action.filesystem?.paths || [];

      const allPaths = [...secretFiles, ...paths];

      for (const path of allPaths) {
        if (this.isSecretFile(path)) {
          const confidence = action.evidence[0]?.confidence || 0.85;
          if (confidence < minConfidence) continue;

          // Avoid duplicate findings
          if (findings.some(f => f.message.includes(path))) continue;

          const finding = this.createFinding(
            document,
            action.anchors,
            `Access to secret-containing file: "${path}".`,
            [
              {
                kind: 'heuristic',
                value: `Secret file pattern: ${path}`,
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

    // Check capability summary for secret file references
    for (const file of context.capabilitySummary.secrets.files_referenced) {
      if (
        this.isSecretFile(file) &&
        !findings.some(f => f.message.includes(file))
      ) {
        const finding = this.createFinding(
          document,
          { start_line: 1, end_line: 1 },
          `Access to secret-containing file: "${file}".`,
          [
            {
              kind: 'heuristic',
              value: `Secret file referenced: ${file}`,
              confidence: 0.75,
            },
          ],
          0.75
        );
        findings.push(finding);
      }
    }

    return findings;
  }

  private isSecretFile(path: string): boolean {
    const normalizedPath = path.toLowerCase();
    return SECRET_FILE_PATTERNS.some(
      pattern =>
        normalizedPath.endsWith(pattern.toLowerCase()) ||
        normalizedPath.includes(pattern.toLowerCase())
    );
  }
}

/**
 * SEC-003: Secret Propagation
 * Secrets used in shell commands, network calls, or file writes
 */
export class SecretPropagationRule extends BaseRule {
  constructor() {
    super({
      id: 'SEC-003',
      group: 'secrets',
      severity: 'high',
      title: 'Secret Propagation',
      description:
        'Secrets are propagated to shell commands, network calls, or file writes. This creates exfiltration and logging risks.',
      recommendation:
        'Never propagate secrets through agent actions. Use secure API authentication methods.',
      tags: ['secrets', 'propagation', 'exfiltration'],
    });
  }

  evaluate(context: RuleContext): Finding[] {
    const findings: Finding[] = [];
    const { document, minConfidence } = context;

    for (const action of document.actions) {
      const propagatesTo = action.secrets?.propagates_to || [];

      if (propagatesTo.length === 0) continue;

      const confidence = action.evidence[0]?.confidence || 0.9;
      if (confidence < minConfidence) continue;

      const destinations = propagatesTo.join(', ');
      const secretVars = action.secrets?.reads_env_vars?.join(', ') || 'secrets';

      const finding = this.createFinding(
        document,
        action.anchors,
        `Secret propagation detected: ${secretVars} propagated to ${destinations}.`,
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

    // Check capability summary for propagation
    if (
      context.capabilitySummary.secrets.propagation_detected &&
      findings.length === 0
    ) {
      const finding = this.createFinding(
        document,
        { start_line: 1, end_line: 1 },
        'Secret propagation detected in document capabilities.',
        [
          {
            kind: 'heuristic',
            value: 'secrets.propagation_detected: true',
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

// Export all secret rules
export const secretRules = [
  new EnvironmentSecretReferenceRule(),
  new ImplicitSecretAccessRule(),
  new SecretPropagationRule(),
];
