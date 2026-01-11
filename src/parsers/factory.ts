/**
 * Parser factory - creates appropriate parser based on file type
 */

import { BaseParser, ParserOptions, ParserResult } from './base';
import { ClaudeParser } from './claude';
import { CursorParser } from './cursor';
import { ToolFamily } from '../ir/types';

export class ParserFactory {
  private parsers: BaseParser[];

  constructor(options: ParserOptions) {
    this.parsers = [
      new ClaudeParser(options),
      new CursorParser(options),
    ];
  }

  /**
   * Get the appropriate parser for a file
   */
  getParser(filePath: string): BaseParser | null {
    for (const parser of this.parsers) {
      if (parser.canHandle(filePath)) {
        return parser;
      }
    }
    return null;
  }

  /**
   * Parse a file using the appropriate parser
   */
  parse(filePath: string, content: string): ParserResult {
    const parser = this.getParser(filePath);

    if (!parser) {
      return {
        document: null,
        errors: [`No parser available for file: ${filePath}`],
        warnings: [],
      };
    }

    return parser.parse(filePath, content);
  }

  /**
   * Check if any parser can handle the file
   */
  canHandle(filePath: string): boolean {
    return this.parsers.some(p => p.canHandle(filePath));
  }

  /**
   * Get supported file patterns
   */
  getSupportedPatterns(): string[] {
    return [
      '.claude/skills/**/*.md',
      '.claude/agents/**/*.md',
      '.claude/hooks/**',
      'CLAUDE.md',
      'AGENTS.md',
      '.cursorrules',
    ];
  }

  /**
   * Detect tool family from file path
   */
  detectToolFamily(filePath: string): ToolFamily {
    const normalizedPath = filePath.toLowerCase();

    if (normalizedPath.includes('.claude/') ||
        normalizedPath.endsWith('claude.md') ||
        normalizedPath.endsWith('agents.md')) {
      return 'claude';
    }

    if (normalizedPath.endsWith('.cursorrules')) {
      return 'cursor';
    }

    return 'unknown';
  }
}
