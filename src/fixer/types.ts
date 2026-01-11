/**
 * Fixer types and interfaces
 */

import { Finding } from '../ir/types';

/**
 * A fix that can be applied to a file
 */
export interface Fix {
  /** The file path to modify */
  path: string;
  /** Description of the fix */
  description: string;
  /** The rule ID this fix addresses */
  ruleId: string;
  /** Type of fix operation */
  type: 'insert' | 'replace' | 'delete';
  /** Line number to apply fix (1-indexed) */
  line: number;
  /** Column number (for replace/delete) */
  column?: number;
  /** Original text (for replace/delete) */
  original?: string;
  /** New text (for insert/replace) */
  replacement?: string;
}

/**
 * Result of attempting to fix findings
 */
export interface FixResult {
  /** Number of fixes applied */
  applied: number;
  /** Number of fixes skipped (not auto-fixable) */
  skipped: number;
  /** Files that were modified */
  modifiedFiles: string[];
  /** Details of each fix */
  fixes: AppliedFix[];
  /** Errors encountered */
  errors: string[];
}

/**
 * A fix that was applied
 */
export interface AppliedFix {
  path: string;
  ruleId: string;
  description: string;
  success: boolean;
  error?: string;
}

/**
 * Rules that support auto-fix
 */
export const FIXABLE_RULES: Record<string, FixStrategy> = {
  'OBS-002': {
    description: 'Add permission manifest comment',
    canFix: true,
    strategy: 'add-manifest',
  },
};

export interface FixStrategy {
  description: string;
  canFix: boolean;
  strategy: string;
}
