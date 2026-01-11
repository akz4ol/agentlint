import { ParserFactory } from '../src/parsers/factory';
import { ClaudeParser } from '../src/parsers/claude';
import { CursorParser } from '../src/parsers/cursor';
import { ParserOptions } from '../src/parsers/base';

const defaultOptions: ParserOptions = {
  sourceId: 'test',
  minConfidence: 0.5,
};

describe('ParserFactory', () => {
  let factory: ParserFactory;

  beforeEach(() => {
    factory = new ParserFactory(defaultOptions);
  });

  describe('getParser()', () => {
    it('should return ClaudeParser for CLAUDE.md', () => {
      const parser = factory.getParser('CLAUDE.md');
      expect(parser).toBeInstanceOf(ClaudeParser);
    });

    it('should return ClaudeParser for .claude/skills/test.md', () => {
      const parser = factory.getParser('.claude/skills/test.md');
      expect(parser).toBeInstanceOf(ClaudeParser);
    });

    it('should return CursorParser for .cursorrules', () => {
      const parser = factory.getParser('.cursorrules');
      expect(parser).toBeInstanceOf(CursorParser);
    });

    it('should return ClaudeParser for AGENTS.md', () => {
      const parser = factory.getParser('AGENTS.md');
      expect(parser).toBeInstanceOf(ClaudeParser);
    });
  });
});

describe('ClaudeParser', () => {
  let parser: ClaudeParser;

  beforeEach(() => {
    parser = new ClaudeParser(defaultOptions);
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
      const result = parser.parse('CLAUDE.md', content);

      expect(result.document).not.toBeNull();
      expect(result.document?.path).toBe('CLAUDE.md');
      expect(result.document?.tool_family).toBe('claude');
      expect(result.document?.doc_type).toBe('memory');
    });

    it('should detect shell execution patterns', () => {
      const content = '# Deploy\n\nRun `npm run build` to build.';
      const result = parser.parse('.claude/skills/deploy.md', content);

      expect(result.document).not.toBeNull();
      const shellActions = result.document?.actions.filter((a) => a.type === 'shell_exec') || [];
      expect(shellActions.length).toBeGreaterThan(0);
    });
  });
});
