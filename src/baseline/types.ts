/**
 * Baseline types for tracking known findings
 */

/**
 * A baselined finding that should be suppressed
 */
export interface BaselinedFinding {
  /** Rule ID */
  rule_id: string;
  /** File path */
  path: string;
  /** Stable fingerprint for matching */
  fingerprint: string;
  /** When the finding was baselined */
  baselined_at: string;
  /** Optional reason for baselining */
  reason?: string;
}

/**
 * Baseline file format
 */
export interface Baseline {
  /** Baseline schema version */
  version: 1;
  /** When the baseline was created */
  created_at: string;
  /** When the baseline was last updated */
  updated_at: string;
  /** Baselined findings */
  findings: BaselinedFinding[];
}

/**
 * Result of filtering findings against baseline
 */
export interface BaselineFilterResult {
  /** New findings not in baseline */
  newFindings: number;
  /** Findings that match baseline */
  suppressedFindings: number;
  /** Baseline entries that no longer match any finding (fixed) */
  fixedFindings: number;
}
