import { Scanner } from '../src/scanner';
import * as path from 'path';

describe('Scanner', () => {
  describe('scan()', () => {
    it('should return PASS for minimal example', async () => {
      const scanner = new Scanner({
        path: path.join(__dirname, '../examples/minimal'),
        format: 'json',
        failOn: 'high',
        warnOn: 'medium',
      });

      const result = await scanner.scan();

      expect(result.status).toBe('pass');
      expect(result.summary.total_findings).toBe(0);
    });

    it('should return FAIL for realistic example with high findings', async () => {
      const scanner = new Scanner({
        path: path.join(__dirname, '../examples/realistic'),
        format: 'json',
        failOn: 'high',
        warnOn: 'medium',
      });

      const result = await scanner.scan();

      expect(result.status).toBe('fail');
      expect(result.summary.counts_by_severity.high).toBeGreaterThan(0);
    });

    it('should detect documents from multiple tool families', async () => {
      const scanner = new Scanner({
        path: path.join(__dirname, '../examples/realistic'),
        format: 'json',
        failOn: 'high',
        warnOn: 'medium',
      });

      const result = await scanner.scan();

      const toolFamilies = new Set(result.documents.map((d) => d.tool_family));
      expect(toolFamilies.has('claude')).toBe(true);
    });
  });
});
