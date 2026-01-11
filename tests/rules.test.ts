import { RuleEngine } from '../src/rules/engine';
import { AgentDocument, CapabilitySummary } from '../src/ir/types';

describe('RuleEngine', () => {
  let engine: RuleEngine;

  beforeEach(() => {
    engine = new RuleEngine();
  });

  describe('getAllRules()', () => {
    it('should return 20 rules', () => {
      const rules = engine.getAllRules();
      expect(rules).toHaveLength(20);
    });

    it('should have rules from all 8 categories', () => {
      const rules = engine.getAllRules();
      const groups = new Set(rules.map((r) => r.group));

      expect(groups).toContain('execution');
      expect(groups).toContain('filesystem');
      expect(groups).toContain('network');
      expect(groups).toContain('secrets');
      expect(groups).toContain('hook');
      expect(groups).toContain('instruction');
      expect(groups).toContain('scope');
      expect(groups).toContain('observability');
    });
  });

  describe('getRule()', () => {
    it('should return rule by ID', () => {
      const rule = engine.getRule('EXEC-001');
      expect(rule).toBeDefined();
      expect(rule?.id).toBe('EXEC-001');
      expect(rule?.title).toBe('Dynamic Shell Execution');
    });

    it('should return undefined for unknown rule', () => {
      const rule = engine.getRule('UNKNOWN-999');
      expect(rule).toBeUndefined();
    });
  });

  describe('evaluateAll()', () => {
    it('should return empty findings for empty documents', () => {
      const findings = engine.evaluateAll([], createEmptyCapabilitySummary());
      expect(findings).toHaveLength(0);
    });
  });
});

function createEmptyCapabilitySummary(): CapabilitySummary {
  return {
    shell_exec: { enabled: false, dynamic_detected: false },
    network: { outbound: false, inbound: false },
    filesystem: {
      read: [],
      write: [],
      scoped: true,
      touches_sensitive_paths: [],
    },
    secrets: {
      env_vars_referenced: [],
      files_containing_secrets_referenced: [],
    },
  };
}
