import { Scanner } from '../src/scanner';
import { DEFAULT_POLICY } from '../src/policy/types';

describe('Scanner', () => {
  describe('constructor', () => {
    it('should create a scanner instance', () => {
      const scanner = new Scanner({
        root: '.',
        include: [],
        exclude: [],
        policy: DEFAULT_POLICY,
        ciMode: false,
      });
      expect(scanner).toBeInstanceOf(Scanner);
    });
  });

  describe('scan()', () => {
    it('should return a result with findings array', async () => {
      const scanner = new Scanner({
        root: './examples/minimal',
        include: [],
        exclude: [],
        policy: DEFAULT_POLICY,
        ciMode: false,
      });

      const result = await scanner.scan();
      expect(result).toHaveProperty('findings');
      expect(Array.isArray(result.findings)).toBe(true);
    });
  });
});
