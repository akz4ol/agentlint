/**
 * Rule types and interfaces
 */

import { AgentDocument, Finding, Severity, CapabilitySummary } from '../ir/types';

/**
 * Rule groups as defined in the taxonomy
 */
export type RuleGroup =
  | 'execution'
  | 'filesystem'
  | 'network'
  | 'secrets'
  | 'hook'
  | 'instruction'
  | 'scope'
  | 'observability';

/**
 * Rule definition metadata
 */
export interface RuleDefinition {
  id: string;
  group: RuleGroup;
  severity: Severity;
  title: string;
  description: string;
  recommendation: string;
  tags: string[];
}

/**
 * Rule evaluation context
 */
export interface RuleContext {
  document: AgentDocument;
  allDocuments: AgentDocument[];
  capabilitySummary: CapabilitySummary;
  minConfidence: number;
}

/**
 * Rule evaluation result
 */
export interface RuleResult {
  rule: RuleDefinition;
  findings: Finding[];
}

/**
 * Base rule interface
 */
export interface Rule {
  /**
   * Get rule definition/metadata
   */
  getDefinition(): RuleDefinition;

  /**
   * Evaluate the rule against a document
   */
  evaluate(context: RuleContext): Finding[];
}

/**
 * Rule engine options
 */
export interface RuleEngineOptions {
  minConfidence: number;
  disabledRules: string[];
  severityOverrides: Record<string, Severity>;
}
