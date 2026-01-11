/**
 * Auto-fixer for AgentLint findings
 */

import * as fs from 'fs';
import * as path from 'path';
import { Finding, CapabilitySummary } from '../ir/types';
import { Fix, FixResult, AppliedFix, FIXABLE_RULES } from './types';

export * from './types';

/**
 * Fixer class for auto-fixing findings
 */
export class Fixer {
  private rootDir: string;
  private dryRun: boolean;

  constructor(options: { rootDir: string; dryRun?: boolean }) {
    this.rootDir = options.rootDir;
    this.dryRun = options.dryRun ?? false;
  }

  /**
   * Check if a finding is auto-fixable
   */
  isFixable(finding: Finding): boolean {
    return finding.rule_id in FIXABLE_RULES && FIXABLE_RULES[finding.rule_id].canFix;
  }

  /**
   * Get list of fixable rule IDs
   */
  getFixableRules(): string[] {
    return Object.keys(FIXABLE_RULES);
  }

  /**
   * Fix all fixable findings
   */
  async fixAll(
    findings: Finding[],
    capabilitySummary: CapabilitySummary
  ): Promise<FixResult> {
    const result: FixResult = {
      applied: 0,
      skipped: 0,
      modifiedFiles: [],
      fixes: [],
      errors: [],
    };

    // Group findings by file
    const findingsByFile = new Map<string, Finding[]>();
    for (const finding of findings) {
      const filePath = finding.location.path;
      if (!findingsByFile.has(filePath)) {
        findingsByFile.set(filePath, []);
      }
      findingsByFile.get(filePath)!.push(finding);
    }

    // Process each file
    for (const [filePath, fileFindings] of findingsByFile) {
      const fixes = this.generateFixes(fileFindings, capabilitySummary);

      if (fixes.length === 0) {
        result.skipped += fileFindings.length;
        continue;
      }

      const applyResult = await this.applyFixes(filePath, fixes);

      result.fixes.push(...applyResult.fixes);
      result.applied += applyResult.applied;
      result.skipped += fileFindings.length - applyResult.applied;
      result.errors.push(...applyResult.errors);

      if (applyResult.applied > 0) {
        result.modifiedFiles.push(filePath);
      }
    }

    return result;
  }

  /**
   * Generate fixes for findings in a file
   */
  private generateFixes(
    findings: Finding[],
    capabilitySummary: CapabilitySummary
  ): Fix[] {
    const fixes: Fix[] = [];

    for (const finding of findings) {
      if (!this.isFixable(finding)) {
        continue;
      }

      const strategy = FIXABLE_RULES[finding.rule_id];

      switch (strategy.strategy) {
        case 'add-manifest':
          fixes.push(this.generateManifestFix(finding, capabilitySummary));
          break;
      }
    }

    return fixes.filter((f): f is Fix => f !== null);
  }

  /**
   * Generate fix for adding permission manifest (OBS-002)
   */
  private generateManifestFix(
    finding: Finding,
    capabilitySummary: CapabilitySummary
  ): Fix {
    const manifest = this.generatePermissionManifest(capabilitySummary);

    return {
      path: finding.location.path,
      description: 'Add permission manifest comment',
      ruleId: finding.rule_id,
      type: 'insert',
      line: 1,
      replacement: manifest + '\n\n',
    };
  }

  /**
   * Generate permission manifest comment
   */
  private generatePermissionManifest(capabilitySummary: CapabilitySummary): string {
    const lines: string[] = [
      '<!-- agentlint:permissions',
      '  filesystem:',
    ];

    if (capabilitySummary.filesystem.read.length > 0) {
      lines.push(`    read: ${JSON.stringify(capabilitySummary.filesystem.read)}`);
    } else {
      lines.push('    read: ["**/*"]');
    }

    if (capabilitySummary.filesystem.write.length > 0) {
      lines.push(`    write: ${JSON.stringify(capabilitySummary.filesystem.write)}`);
    }

    lines.push('  shell_exec:');
    lines.push(`    enabled: ${capabilitySummary.shell_exec.enabled}`);

    if (capabilitySummary.shell_exec.examples.length > 0) {
      lines.push(`    allowed_commands: ${JSON.stringify(capabilitySummary.shell_exec.examples.slice(0, 5))}`);
    }

    lines.push('  network:');
    lines.push(`    outbound: ${capabilitySummary.network.outbound}`);

    if (capabilitySummary.network.allowed_domains.length > 0) {
      lines.push(`    allowed_domains: ${JSON.stringify(capabilitySummary.network.allowed_domains)}`);
    }

    lines.push('-->');

    return lines.join('\n');
  }

  /**
   * Apply fixes to a file
   */
  private async applyFixes(
    filePath: string,
    fixes: Fix[]
  ): Promise<{ fixes: AppliedFix[]; applied: number; errors: string[] }> {
    const result = {
      fixes: [] as AppliedFix[],
      applied: 0,
      errors: [] as string[],
    };

    const fullPath = path.join(this.rootDir, filePath);

    let content: string;
    try {
      content = fs.readFileSync(fullPath, 'utf-8');
    } catch (err) {
      result.errors.push(`Failed to read ${filePath}: ${err}`);
      return result;
    }

    // Sort fixes by line number descending so we can apply from bottom up
    const sortedFixes = [...fixes].sort((a, b) => b.line - a.line);

    let modified = content;
    const lines = modified.split('\n');

    for (const fix of sortedFixes) {
      try {
        switch (fix.type) {
          case 'insert':
            // Insert at beginning of specified line
            lines.splice(fix.line - 1, 0, ...(fix.replacement || '').split('\n'));
            result.fixes.push({
              path: filePath,
              ruleId: fix.ruleId,
              description: fix.description,
              success: true,
            });
            result.applied++;
            break;

          case 'replace':
            if (fix.original && fix.replacement) {
              const lineContent = lines[fix.line - 1];
              if (lineContent.includes(fix.original)) {
                lines[fix.line - 1] = lineContent.replace(fix.original, fix.replacement);
                result.fixes.push({
                  path: filePath,
                  ruleId: fix.ruleId,
                  description: fix.description,
                  success: true,
                });
                result.applied++;
              }
            }
            break;

          case 'delete':
            lines.splice(fix.line - 1, 1);
            result.fixes.push({
              path: filePath,
              ruleId: fix.ruleId,
              description: fix.description,
              success: true,
            });
            result.applied++;
            break;
        }
      } catch (err) {
        result.fixes.push({
          path: filePath,
          ruleId: fix.ruleId,
          description: fix.description,
          success: false,
          error: String(err),
        });
        result.errors.push(`Failed to apply fix ${fix.ruleId} to ${filePath}: ${err}`);
      }
    }

    // Write back if not dry run and we made changes
    if (!this.dryRun && result.applied > 0) {
      try {
        modified = lines.join('\n');
        fs.writeFileSync(fullPath, modified, 'utf-8');
      } catch (err) {
        result.errors.push(`Failed to write ${filePath}: ${err}`);
      }
    }

    return result;
  }
}
