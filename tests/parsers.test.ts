import { ParserFactory } from '../src/parsers/factory';
import { ClaudeParser } from '../src/parsers/claude';
import { CursorParser } from '../src/parsers/cursor';

describe('ParserFactory', () => {
  describe('getParser()', () => {
    it('should return ClaudeParser for CLAUDE.md', () => {
      const parser = ParserFactory.getParser('CLAUDE.md');
      expect(parser).toBeInstanceOf(ClaudeParser);
    });

    it('should return ClaudeParser for .claude/skills/test.md', () => {
      const parser = ParserFactory.getParser('.claude/skills/test.md');
      expect(parser).toBeInstanceOf(ClaudeParser);
    });

    it('should return CursorParser for .cursorrules', () => {
      const parser = ParserFactory.getParser('.cursorrules');
      expect(parser).toBeInstanceOf(CursorParser);
    });

    it('should return ClaudeParser for AGENTS.md', () => {
      const parser = ParserFactory.getParser('AGENTS.md');
      expect(parser).toBeInstanceOf(ClaudeParser);
    });
  });
});

describe('ClaudeParser', () => {
  let parser: ClaudeParser;

  beforeEach(() => {
    parser = new ClaudeParser();
  });

  describe('canHandle()', () => {
    it('should handle CLAUDE.md', () => {
      expect(parser.canHandle('CLAUDE.md')).toBe(true);
    });

    it('should handle .claude/skills/*.md', () => {
      expect(parser.canHandle('.claude/skills/deploy.md')).toBe(true);
    });

    it('should not handle .cursorrules', () => {
      expect(parser.canHandle('.cursorrules')).toBe(false);
    });
  });

  describe('parse()', () => {
    it('should parse simple CLAUDE.md', () => {
      const content = '# Project Guidelines\n\nThis is a test project.';
      const doc = parser.parse('CLAUDE.md', content);

      expect(doc.path).toBe('CLAUDE.md');
      expect(doc.tool_family).toBe('claude');
      expect(doc.doc_type).toBe('memory');
    });

    it('should detect shell execution patterns', () => {
      const content = '# Deploy\n\nRun `npm run build` to build.';
      const doc = parser.parse('.claude/skills/deploy.md', content);

      const shellActions = doc.actions.filter((a) => a.type === 'shell_exec');
      expect(shellActions.length).toBeGreaterThan(0);
    });
  });
});
