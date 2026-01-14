/**
 * AgentLint Scanner
 * Core orchestration for parsing, rule evaluation, and report generation
 */

import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';
import {
  AgentDocument,
  AgentLintReport,
  CapabilitySummary,
  DocumentSummary,
  Finding,
  PermissionManifest,
  ScanStatus,
  PERMISSIONS_VERSION,
  REPORT_VERSION,
  IR_SCHEMA_VERSION,
  Severity,
} from './ir/types';
import { ParserFactory } from './parsers/factory';
import { RuleEngine } from './rules/engine';
import { PolicyConfig, DEFAULT_POLICY } from './policy/types';
import { generateId } from './utils/hash';
import { ReportData } from './reports/types';

export interface ScanOptions {
  root: string;
  include: string[];
  exclude: string[];
  policy: PolicyConfig;
  ciMode: boolean;
}

export interface ScanResult {
  documents: AgentDocument[];
  findings: Finding[];
  capabilitySummary: CapabilitySummary;
  recommendedPermissions: PermissionManifest;
  status: ScanStatus;
  exitCode: number;
  errors: string[];
}

/**
 * Main scanner class
 */
export class Scanner {
  private parserFactory: ParserFactory;
  private ruleEngine: RuleEngine;
  private options: ScanOptions;

  constructor(options: Partial<ScanOptions> = {}) {
    this.options = {
      root: options.root || process.cwd(),
      include: options.include || DEFAULT_POLICY.scan.include,
      exclude: options.exclude || DEFAULT_POLICY.scan.exclude,
      policy: options.policy || DEFAULT_POLICY,
      ciMode: options.ciMode || false,
    };

    const sourceId = generateId('src');
    this.parserFactory = new ParserFactory({
      sourceId,
      minConfidence: this.options.policy.scan.min_parse_confidence,
    });

    this.ruleEngine = new RuleEngine({
      minConfidence: this.options.policy.policy.min_finding_confidence,
      disabledRules: this.options.policy.rules.disable,
      severityOverrides: this.options.policy.rules.severity_overrides,
    });
  }

  /**
   * Run the scan
   */
  async scan(): Promise<ScanResult> {
    const errors: string[] = [];

    // Find files to scan
    const files = await this.findFiles();

    if (files.length === 0) {
      const status = this.options.policy.policy.no_supported_files_as === 'fail' ? 'fail' :
                     this.options.policy.policy.no_supported_files_as === 'warn' ? 'warn' : 'pass';
      const exitCode = status === 'fail' ? 4 : 0;

      return {
        documents: [],
        findings: [],
        capabilitySummary: this.createEmptyCapabilitySummary(),
        recommendedPermissions: this.createEmptyPermissionManifest(),
        status,
        exitCode,
        errors: ['No supported agent configuration files found'],
      };
    }

    // Parse all files
    const documents: AgentDocument[] = [];
    for (const file of files) {
      try {
        const content = fs.readFileSync(file, 'utf-8');
        const relativePath = path.relative(this.options.root, file);
        const result = this.parserFactory.parse(relativePath, content);

        if (result.document) {
          documents.push(result.document);
        }
        if (result.errors.length > 0) {
          errors.push(...result.errors);
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        errors.push(`Failed to read ${file}: ${msg}`);
      }
    }

    // Compute capability summary
    const capabilitySummary = this.computeCapabilitySummary(documents);

    // Run rule engine
    const findings = this.ruleEngine.evaluateAll(documents, capabilitySummary);

    // Generate recommended permissions
    const recommendedPermissions = this.generateRecommendedPermissions(capabilitySummary);

    // Determine status and exit code
    const { status, exitCode } = this.determineStatus(findings, errors);

    return {
      documents,
      findings,
      capabilitySummary,
      recommendedPermissions,
      status,
      exitCode,
      errors,
    };
  }

  /**
   * Find files matching the include/exclude patterns
   */
  private async findFiles(): Promise<string[]> {
    const allFiles: string[] = [];

    for (const pattern of this.options.include) {
      const matches = await glob(pattern, {
        cwd: this.options.root,
        absolute: true,
        ignore: this.options.exclude,
        nodir: true,
      });
      allFiles.push(...matches);
    }

    // Filter to only files we can handle
    const supportedFiles = allFiles.filter(f => {
      const relativePath = path.relative(this.options.root, f);
      return this.parserFactory.canHandle(relativePath);
    });

    // Deduplicate
    return [...new Set(supportedFiles)];
  }

  /**
   * Compute capability summary from all documents
   */
  private computeCapabilitySummary(documents: AgentDocument[]): CapabilitySummary {
    const summary: CapabilitySummary = {
      filesystem: {
        read: [],
        write: [],
        touches_sensitive_paths: [],
      },
      shell_exec: {
        enabled: false,
        dynamic_detected: false,
        examples: [],
      },
      network: {
        outbound: false,
        inbound: false,
        allowed_domains: [],
        fetches_executable: false,
      },
      secrets: {
        env_vars_referenced: [],
        files_referenced: [],
        propagation_detected: false,
      },
      git: {
        ops: [],
      },
      contexts: {
        has_hooks: false,
        has_ci_context: false,
      },
    };

    for (const doc of documents) {
      // Check context
      if (doc.doc_type === 'hook') {
        summary.contexts.has_hooks = true;
      }
      if (doc.context_profile.runs_in_privileged_env) {
        summary.contexts.has_ci_context = true;
      }

      // Process actions
      for (const action of doc.actions) {
        switch (action.type) {
          case 'shell_exec':
            summary.shell_exec.enabled = true;
            if (action.shell?.dynamic) {
              summary.shell_exec.dynamic_detected = true;
            }
            if (action.shell?.command && summary.shell_exec.examples.length < 5) {
              summary.shell_exec.examples.push(action.shell.command);
            }
            break;

          case 'network_call':
            if (action.network?.direction === 'outbound') {
              summary.network.outbound = true;
            }
            if (action.network?.direction === 'inbound') {
              summary.network.inbound = true;
            }
            if (action.network?.domains) {
              summary.network.allowed_domains.push(...action.network.domains);
            }
            if (action.network?.fetches_executable) {
              summary.network.fetches_executable = true;
            }
            break;

          case 'file_write':
            if (action.filesystem?.paths) {
              summary.filesystem.write.push(...action.filesystem.paths);
            }
            if (action.filesystem?.sensitive_paths_touched) {
              summary.filesystem.touches_sensitive_paths.push(
                ...action.filesystem.sensitive_paths_touched
              );
            }
            break;

          case 'file_read':
            if (action.filesystem?.paths) {
              summary.filesystem.read.push(...action.filesystem.paths);
            }
            break;

          case 'git_operation':
            if (action.git?.operation) {
              summary.git.ops.push(action.git.operation);
            }
            break;
        }

        // Check for secrets
        if (action.secrets) {
          if (action.secrets.reads_env_vars) {
            summary.secrets.env_vars_referenced.push(...action.secrets.reads_env_vars);
          }
          if (action.secrets.reads_files) {
            summary.secrets.files_referenced.push(...action.secrets.reads_files);
          }
          if (action.secrets.propagates_to && action.secrets.propagates_to.length > 0) {
            summary.secrets.propagation_detected = true;
          }
        }
      }
    }

    // Deduplicate arrays
    summary.filesystem.read = [...new Set(summary.filesystem.read)];
    summary.filesystem.write = [...new Set(summary.filesystem.write)];
    summary.filesystem.touches_sensitive_paths = [...new Set(summary.filesystem.touches_sensitive_paths)];
    summary.network.allowed_domains = [...new Set(summary.network.allowed_domains)];
    summary.secrets.env_vars_referenced = [...new Set(summary.secrets.env_vars_referenced)];
    summary.secrets.files_referenced = [...new Set(summary.secrets.files_referenced)];
    summary.git.ops = [...new Set(summary.git.ops)];

    return summary;
  }

  /**
   * Generate recommended permission manifest based on detected capabilities
   */
  private generateRecommendedPermissions(summary: CapabilitySummary): PermissionManifest {
    // Generate a conservative (restrictive) manifest based on what we detected
    return {
      manifest_version: PERMISSIONS_VERSION,
      permissions: {
        filesystem: {
          read: summary.filesystem.read.length > 0 ? summary.filesystem.read : ['**/*'],
          write: summary.filesystem.write.filter(p => !this.isBroadPath(p)),
          delete: [],
        },
        shell_exec: {
          // Recommend disabling shell if dynamic execution was detected
          enabled: summary.shell_exec.enabled && !summary.shell_exec.dynamic_detected,
          allowed_commands: summary.shell_exec.examples
            .filter(cmd => !this.isDynamicCommand(cmd))
            .slice(0, 10),
        },
        network: {
          // Recommend disabling network if executable fetching was detected
          outbound: summary.network.outbound && !summary.network.fetches_executable,
          allowed_domains: summary.network.allowed_domains,
        },
        secrets: {
          // Recommend no secret access
          env_vars: [],
          files: [],
        },
        git: {
          allowed_ops: summary.git.ops,
        },
      },
    };
  }

  private isBroadPath(path: string): boolean {
    return ['**/*', '**', '*', './'].includes(path);
  }

  private isDynamicCommand(cmd: string): boolean {
    return /curl.*\|.*(?:bash|sh)/i.test(cmd) ||
           /wget.*\|.*(?:bash|sh)/i.test(cmd) ||
           /\beval\b/i.test(cmd);
  }

  /**
   * Determine scan status and exit code based on findings
   */
  private determineStatus(findings: Finding[], errors: string[]): { status: ScanStatus; exitCode: number } {
    const policy = this.options.policy.policy;

    // Check for high severity findings
    if (policy.fail_on !== 'none') {
      const failFindings = this.ruleEngine.filterBySeverity(findings, policy.fail_on as Severity);
      if (failFindings.length > 0) {
        return { status: 'fail', exitCode: 1 };
      }
    }

    // Check for warning severity findings
    if (policy.warn_on !== 'none') {
      const warnFindings = this.ruleEngine.filterBySeverity(findings, policy.warn_on as Severity);
      if (warnFindings.length > 0) {
        return { status: 'warn', exitCode: 0 };
      }
    }

    // Check for parse errors in strict mode
    if (policy.strict && errors.length > 0) {
      return { status: 'fail', exitCode: 4 };
    }

    return { status: 'pass', exitCode: 0 };
  }

  private createEmptyCapabilitySummary(): CapabilitySummary {
    return {
      filesystem: { read: [], write: [], touches_sensitive_paths: [] },
      shell_exec: { enabled: false, dynamic_detected: false, examples: [] },
      network: { outbound: false, inbound: false, allowed_domains: [], fetches_executable: false },
      secrets: { env_vars_referenced: [], files_referenced: [], propagation_detected: false },
      git: { ops: [] },
      contexts: { has_hooks: false, has_ci_context: false },
    };
  }

  private createEmptyPermissionManifest(): PermissionManifest {
    return {
      manifest_version: PERMISSIONS_VERSION,
      permissions: {
        filesystem: { read: [], write: [], delete: [] },
        shell_exec: { enabled: false, allowed_commands: [] },
        network: { outbound: false, allowed_domains: [] },
        secrets: { env_vars: [], files: [] },
        git: { allowed_ops: [] },
      },
    };
  }

  /**
   * Create report data for output generation
   */
  createReportData(result: ScanResult): ReportData {
    const documentSummaries: DocumentSummary[] = result.documents.map(doc => ({
      doc_id: doc.doc_id,
      path: doc.path,
      tool_family: doc.tool_family,
      doc_type: doc.doc_type,
      format: doc.format,
      hash: doc.hash.value,
      parse: doc.parse,
      context_profile: doc.context_profile,
      action_counts: {
        shell_exec: doc.actions.filter(a => a.type === 'shell_exec').length,
        file_write: doc.actions.filter(a => a.type === 'file_write').length,
        network_call: doc.actions.filter(a => a.type === 'network_call').length,
        secrets: doc.actions.filter(a => a.secrets && (a.secrets.reads_env_vars?.length || a.secrets.reads_files?.length)).length,
      },
    }));

    const counts = this.ruleEngine.countBySeverity(result.findings);

    const report: AgentLintReport = {
      report_version: REPORT_VERSION,
      schema_version: IR_SCHEMA_VERSION,
      generated_at: new Date().toISOString(),
      tool: {
        name: 'agentlint',
        version: '0.1.0',
        build: {
          os: process.platform,
          arch: process.arch,
        },
      },
      inputs: {
        scan_root: this.options.root,
        sources: [],
        include: this.options.include,
        exclude: this.options.exclude,
        tool_mode: this.options.policy.scan.tool_mode,
      },
      policy: {
        ci_mode: this.options.ciMode,
        fail_on: this.options.policy.policy.fail_on,
        warn_on: this.options.policy.policy.warn_on,
        min_confidence: this.options.policy.policy.min_finding_confidence,
        rules_disabled: this.options.policy.rules.disable,
        severity_overrides: this.options.policy.rules.severity_overrides,
      },
      summary: {
        documents_scanned: result.documents.length,
        files_matched: result.documents.length,
        parse: {
          ok: result.documents.filter(d => d.parse.status === 'ok').length,
          partial: result.documents.filter(d => d.parse.status === 'partial').length,
          failed: result.documents.filter(d => d.parse.status === 'failed').length,
        },
        contexts: {
          has_hooks: result.capabilitySummary.contexts.has_hooks,
          has_ci_context: result.capabilitySummary.contexts.has_ci_context,
        },
        counts_by_severity: counts,
        status: result.status,
        exit_code: result.exitCode,
      },
      documents: documentSummaries,
      capability_summary: result.capabilitySummary,
      recommended_permissions: result.recommendedPermissions,
      findings: result.findings,
      diff: null,
      errors: result.errors.map(e => ({ code: 'INTERNAL_ERROR' as const, message: e })),
      annotations: {},
    };

    return {
      report,
      findings: result.findings,
      capabilitySummary: result.capabilitySummary,
      recommendedPermissions: result.recommendedPermissions,
      documents: documentSummaries,
      status: result.status,
      exitCode: result.exitCode,
    };
  }
}
