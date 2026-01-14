/**
 * Base rule class with common functionality
 */

import { Finding, AgentDocument, Evidence, Anchors } from '../ir/types';
import { Rule, RuleDefinition, RuleContext } from './types';
import {
  generateFindingId,
  generateLocationFingerprint,
  generateContentFingerprint,
} from '../utils/hash';

export abstract class BaseRule implements Rule {
  protected definition: RuleDefinition;

  constructor(definition: RuleDefinition) {
    this.definition = definition;
  }

  getDefinition(): RuleDefinition {
    return this.definition;
  }

  abstract evaluate(context: RuleContext): Finding[];

  /**
   * Create a finding with proper fingerprints
   */
  protected createFinding(
    document: AgentDocument,
    location: Anchors,
    message: string,
    evidence: Evidence[],
    confidence: number = 0.9
  ): Finding {
    const evidenceValue = evidence.length > 0 ? evidence[0].value : '';

    return {
      finding_id: generateFindingId(
        this.definition.id,
        document.path,
        location.start_line,
        evidenceValue
      ),
      rule_id: this.definition.id,
      group: this.definition.group,
      severity: this.definition.severity,
      title: this.definition.title,
      description: this.definition.description,
      message,
      recommendation: this.definition.recommendation,
      confidence,
      tags: this.definition.tags,
      location: {
        path: document.path,
        start_line: location.start_line,
        end_line: location.end_line,
      },
      evidence,
      related_actions: [],
      fingerprints: {
        stable: generateFindingId(
          this.definition.id,
          document.path,
          location.start_line,
          evidenceValue
        ),
        location: generateLocationFingerprint(
          this.definition.id,
          document.path,
          location.start_line,
          location.end_line
        ),
        content: generateContentFingerprint(this.definition.id, evidenceValue),
      },
    };
  }
}
