import { RuleEngine } from '../src/rules/engine';

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

  describe('getRuleDefinition()', () => {
    it('should return rule definition by ID', () => {
      const def = engine.getRuleDefinition('EXEC-001');
      expect(def).toBeDefined();
      expect(def?.id).toBe('EXEC-001');
      expect(def?.title).toBe('Dynamic Shell Execution');
    });

    it('should return undefined for unknown rule', () => {
      const def = engine.getRuleDefinition('UNKNOWN-999');
      expect(def).toBeUndefined();
    });
  });
});
