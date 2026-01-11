/**
 * Diff functionality for comparing agent configuration versions
 */

import { CapabilitySummary, DiffChange, DiffResult, Finding, ScanStatus, Severity } from '../ir/types';
import { ScanResult, Scanner, ScanOptions } from '../scanner';
import { PolicyConfig } from '../policy/types';
import { generateId } from '../utils/hash';

export interface DiffOptions {
  policy: PolicyConfig;
  failOn: string[];
  warnOn: string[];
}

/**
 * Compare two scan results and generate a diff
 */
export function compareScanResults(
  base: ScanResult,
  target: ScanResult,
  baseRef: string,
  targetRef: string,
  options: DiffOptions
): DiffResult {
  const changes: DiffChange[] = [];

  // Detect capability expansions
  const capabilityChanges = detectCapabilityChanges(
    base.capabilitySummary,
    target.capabilitySummary
  );
  changes.push(...capabilityChanges);

  // Detect new findings
  const newFindings = findNewFindings(base.findings, target.findings);
  const resolvedFindings = findNewFindings(target.findings, base.findings);

  // Count new high findings
  const newHighFindings = newFindings.filter(f => f.severity === 'high').length;

  // Determine if capability expansion occurred
  const capabilityExpansion = capabilityChanges.some(c =>
    c.type === 'capability_expansion' ||
    c.type === 'network_new_outbound' ||
    c.type === 'shell_dynamic_introduced'
  );

  // Determine status based on changes
  const { status, exitCode } = determineDiffStatus(
    changes,
    newFindings,
    options
  );

  return {
    base: {
      ref: baseRef,
      tree_hash: generateId('hash'),
    },
    target: {
      ref: targetRef,
      tree_hash: generateId('hash'),
    },
    summary: {
      capability_expansion: capabilityExpansion,
      new_high_findings: newHighFindings,
      status,
      exit_code: exitCode,
    },
    changes,
    new_findings: newFindings,
    resolved_findings: resolvedFindings,
  };
}

/**
 * Detect capability changes between two summaries
 */
function detectCapabilityChanges(
  base: CapabilitySummary,
  target: CapabilitySummary
): DiffChange[] {
  const changes: DiffChange[] = [];

  // Shell execution changes
  if (!base.shell_exec.enabled && target.shell_exec.enabled) {
    changes.push({
      change_id: generateId('change'),
      type: 'capability_expansion',
      severity: 'high',
      message: 'shell_exec.enabled: false → true',
      details: { field: 'shell_exec.enabled', from: false, to: true },
    });
  }

  if (!base.shell_exec.dynamic_detected && target.shell_exec.dynamic_detected) {
    changes.push({
      change_id: generateId('change'),
      type: 'shell_dynamic_introduced',
      severity: 'high',
      message: 'shell_exec.dynamic: false → true',
      details: { field: 'shell_exec.dynamic_detected', from: false, to: true },
    });
  }

  // Network changes
  if (!base.network.outbound && target.network.outbound) {
    changes.push({
      change_id: generateId('change'),
      type: 'network_new_outbound',
      severity: 'high',
      message: 'network.outbound: false → true',
      details: { field: 'network.outbound', from: false, to: true },
    });
  }

  if (!base.network.inbound && target.network.inbound) {
    changes.push({
      change_id: generateId('change'),
      type: 'network_expansion',
      severity: 'medium',
      message: 'network.inbound: false → true',
      details: { field: 'network.inbound', from: false, to: true },
    });
  }

  if (!base.network.fetches_executable && target.network.fetches_executable) {
    changes.push({
      change_id: generateId('change'),
      type: 'capability_expansion',
      severity: 'high',
      message: 'network.fetches_executable: false → true',
      details: { field: 'network.fetches_executable', from: false, to: true },
    });
  }

  // Context changes
  if (!base.contexts.has_hooks && target.contexts.has_hooks) {
    changes.push({
      change_id: generateId('change'),
      type: 'context_change_to_hook',
      severity: 'high',
      message: 'Hooks added to configuration',
      details: { field: 'contexts.has_hooks', from: false, to: true },
    });
  }

  if (!base.contexts.has_ci_context && target.contexts.has_ci_context) {
    changes.push({
      change_id: generateId('change'),
      type: 'context_change_to_ci',
      severity: 'medium',
      message: 'CI context added to configuration',
      details: { field: 'contexts.has_ci_context', from: false, to: true },
    });
  }

  // Filesystem changes
  const newSensitivePaths = target.filesystem.touches_sensitive_paths.filter(
    p => !base.filesystem.touches_sensitive_paths.includes(p)
  );
  if (newSensitivePaths.length > 0) {
    changes.push({
      change_id: generateId('change'),
      type: 'sensitive_path_newly_touched',
      severity: 'high',
      message: `New sensitive paths touched: ${newSensitivePaths.join(', ')}`,
      details: { new_paths: newSensitivePaths },
    });
  }

  // Write scope widening
  const broadPatterns = ['**/*', '**', '*'];
  const targetHasBroad = target.filesystem.write.some(w => broadPatterns.includes(w));
  const baseHadBroad = base.filesystem.write.some(w => broadPatterns.includes(w));

  if (targetHasBroad && !baseHadBroad) {
    changes.push({
      change_id: generateId('change'),
      type: 'write_scope_widening_to_all',
      severity: 'high',
      message: 'Write scope widened to include all files',
      details: {
        base_writes: base.filesystem.write,
        target_writes: target.filesystem.write,
      },
    });
  }

  // Secrets changes
  const newSecretVars = target.secrets.env_vars_referenced.filter(
    v => !base.secrets.env_vars_referenced.includes(v)
  );
  if (newSecretVars.length > 0) {
    changes.push({
      change_id: generateId('change'),
      type: 'capability_expansion',
      severity: 'high',
      message: `New secret variables referenced: ${newSecretVars.join(', ')}`,
      details: { new_secret_vars: newSecretVars },
    });
  }

  if (!base.secrets.propagation_detected && target.secrets.propagation_detected) {
    changes.push({
      change_id: generateId('change'),
      type: 'capability_expansion',
      severity: 'high',
      message: 'Secret propagation detected',
      details: { field: 'secrets.propagation_detected', from: false, to: true },
    });
  }

  return changes;
}

/**
 * Find findings that exist in target but not in base
 */
function findNewFindings(base: Finding[], target: Finding[]): Finding[] {
  const baseFingerprints = new Set(base.map(f => f.fingerprints.stable));
  return target.filter(f => !baseFingerprints.has(f.fingerprints.stable));
}

/**
 * Determine diff status based on changes and new findings
 */
function determineDiffStatus(
  changes: DiffChange[],
  newFindings: Finding[],
  options: DiffOptions
): { status: ScanStatus; exitCode: number } {
  // Check fail conditions
  for (const changeType of options.failOn) {
    if (changes.some(c => c.type === changeType)) {
      return { status: 'fail', exitCode: 1 };
    }
  }

  // Check if new high findings
  if (options.failOn.includes('new_high_findings')) {
    if (newFindings.some(f => f.severity === 'high')) {
      return { status: 'fail', exitCode: 1 };
    }
  }

  // Check warn conditions
  for (const changeType of options.warnOn) {
    if (changes.some(c => c.type === changeType)) {
      return { status: 'warn', exitCode: 0 };
    }
  }

  // Check if new medium findings
  if (options.warnOn.includes('new_medium_findings')) {
    if (newFindings.some(f => f.severity === 'medium')) {
      return { status: 'warn', exitCode: 0 };
    }
  }

  return { status: 'pass', exitCode: 0 };
}
