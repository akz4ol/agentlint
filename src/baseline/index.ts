/**
 * Baseline manager for tracking and suppressing known findings
 */

import * as fs from 'fs';
import * as path from 'path';
import { Finding } from '../ir/types';
import { Baseline, BaselinedFinding, BaselineFilterResult } from './types';

export * from './types';

const BASELINE_FILENAME = '.agentlint-baseline.json';

/**
 * Baseline manager class
 */
export class BaselineManager {
  private baselinePath: string;
  private baseline: Baseline | null = null;

  constructor(rootDir: string, customPath?: string) {
    this.baselinePath = customPath || path.join(rootDir, BASELINE_FILENAME);
  }

  /**
   * Load baseline from file
   */
  load(): boolean {
    if (!fs.existsSync(this.baselinePath)) {
      return false;
    }

    try {
      const content = fs.readFileSync(this.baselinePath, 'utf-8');
      this.baseline = JSON.parse(content) as Baseline;
      return true;
    } catch (err) {
      console.error(`Failed to load baseline: ${err}`);
      return false;
    }
  }

  /**
   * Check if a baseline exists
   */
  exists(): boolean {
    return fs.existsSync(this.baselinePath);
  }

  /**
   * Get the baseline path
   */
  getPath(): string {
    return this.baselinePath;
  }

  /**
   * Create a new baseline from findings
   */
  create(findings: Finding[], reason?: string): Baseline {
    const now = new Date().toISOString();

    this.baseline = {
      version: 1,
      created_at: now,
      updated_at: now,
      findings: findings.map(f => this.findingToBaseline(f, reason)),
    };

    return this.baseline;
  }

  /**
   * Update baseline with new findings (add to existing)
   */
  update(findings: Finding[], reason?: string): Baseline {
    if (!this.baseline) {
      return this.create(findings, reason);
    }

    const now = new Date().toISOString();
    const existingFingerprints = new Set(this.baseline.findings.map(f => f.fingerprint));

    // Add new findings that aren't already baselined
    for (const finding of findings) {
      const fingerprint = finding.fingerprints.stable;
      if (!existingFingerprints.has(fingerprint)) {
        this.baseline.findings.push(this.findingToBaseline(finding, reason));
      }
    }

    this.baseline.updated_at = now;
    return this.baseline;
  }

  /**
   * Save baseline to file
   */
  save(): void {
    if (!this.baseline) {
      throw new Error('No baseline to save');
    }

    fs.writeFileSync(
      this.baselinePath,
      JSON.stringify(this.baseline, null, 2),
      'utf-8'
    );
  }

  /**
   * Filter findings against baseline, returning only new findings
   */
  filterFindings(findings: Finding[]): {
    filtered: Finding[];
    result: BaselineFilterResult;
  } {
    if (!this.baseline) {
      return {
        filtered: findings,
        result: {
          newFindings: findings.length,
          suppressedFindings: 0,
          fixedFindings: 0,
        },
      };
    }

    const baselineFingerprints = new Set(this.baseline.findings.map(f => f.fingerprint));
    const matchedFingerprints = new Set<string>();

    const filtered = findings.filter(finding => {
      const fingerprint = finding.fingerprints.stable;
      if (baselineFingerprints.has(fingerprint)) {
        matchedFingerprints.add(fingerprint);
        return false; // Suppress
      }
      return true; // New finding
    });

    // Count fixed findings (in baseline but not in current findings)
    const fixedFindings = this.baseline.findings.filter(
      bf => !matchedFingerprints.has(bf.fingerprint)
    ).length;

    return {
      filtered,
      result: {
        newFindings: filtered.length,
        suppressedFindings: findings.length - filtered.length,
        fixedFindings,
      },
    };
  }

  /**
   * Remove fixed findings from baseline
   */
  prune(currentFindings: Finding[]): number {
    if (!this.baseline) {
      return 0;
    }

    const currentFingerprints = new Set(
      currentFindings.map(f => f.fingerprints.stable)
    );

    const before = this.baseline.findings.length;
    this.baseline.findings = this.baseline.findings.filter(
      bf => currentFingerprints.has(bf.fingerprint)
    );
    const removed = before - this.baseline.findings.length;

    if (removed > 0) {
      this.baseline.updated_at = new Date().toISOString();
    }

    return removed;
  }

  /**
   * Get baseline stats
   */
  getStats(): { total: number; byRule: Record<string, number> } {
    if (!this.baseline) {
      return { total: 0, byRule: {} };
    }

    const byRule: Record<string, number> = {};
    for (const f of this.baseline.findings) {
      byRule[f.rule_id] = (byRule[f.rule_id] || 0) + 1;
    }

    return {
      total: this.baseline.findings.length,
      byRule,
    };
  }

  /**
   * Convert a Finding to a BaselinedFinding
   */
  private findingToBaseline(finding: Finding, reason?: string): BaselinedFinding {
    return {
      rule_id: finding.rule_id,
      path: finding.location.path,
      fingerprint: finding.fingerprints.stable,
      baselined_at: new Date().toISOString(),
      reason,
    };
  }
}
