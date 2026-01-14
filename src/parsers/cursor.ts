/**
 * Cursor configuration parser
 * Handles: .cursorrules
 */

import { BaseParser, ParserResult, ParserOptions } from './base';
import {
  AgentDocument,
  ContextType,
  InstructionBlock,
  ToolFamily,
} from '../ir/types';
import { generateId } from '../utils/hash';

export class CursorParser extends BaseParser {
  constructor(options: ParserOptions) {
    super(options);
  }

  getToolFamily(): ToolFamily {
    return 'cursor';
  }

  canHandle(filePath: string): boolean {
    const normalizedPath = filePath.toLowerCase();
    return normalizedPath.endsWith('.cursorrules');
  }

  parse(filePath: string, content: string): ParserResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      const document = this.createBaseDocument(
        filePath,
        content,
        'rules',
        'text'
      );

      // Cursor rules are typically interactive context
      document.context_profile = {
        primary: 'interactive',
        triggers: [],
        requires_user_confirmation: true,
        runs_in_privileged_env: false,
      };

      // Parse the content
      this.parseRulesContent(document, content, errors, warnings);

      // Derive capabilities from actions
      document.capabilities = this.deriveCapabilities(document.actions);

      // Update parse result
      if (errors.length > 0) {
        document.parse.status = 'partial';
        document.parse.errors = errors;
      }
      if (warnings.length > 0) {
        document.parse.notes = warnings;
      }

      return { document, errors, warnings };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      return {
        document: null,
        errors: [`Failed to parse ${filePath}: ${errorMsg}`],
        warnings,
      };
    }
  }

  private parseRulesContent(
    doc: AgentDocument,
    content: string,
    _errors: string[],
    _warnings: string[]
  ): void {
    const lines = content.split('\n');
    const context: ContextType = 'interactive';

    let currentBlock: InstructionBlock | null = null;
    let inCodeBlock = false;
    let codeBlockStart = 0;
    let codeBlockContent: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNum = i + 1;

      // Handle code blocks
      if (line.trim().startsWith('```')) {
        if (!inCodeBlock) {
          inCodeBlock = true;
          codeBlockStart = lineNum;
          codeBlockContent = [];
        } else {
          // End of code block - analyze content
          const fullCode = codeBlockContent.join('\n');
          this.analyzeCodeBlock(doc, fullCode, {
            start_line: codeBlockStart,
            end_line: lineNum,
          }, context);
          inCodeBlock = false;
          codeBlockContent = [];
        }
        continue;
      }

      if (inCodeBlock) {
        codeBlockContent.push(line);
        continue;
      }

      // Extract rule blocks
      if (this.isRuleStart(line)) {
        if (currentBlock) {
          doc.instruction_blocks.push(currentBlock);
        }
        currentBlock = {
          block_id: generateId('block'),
          kind: this.classifyRuleKind(line),
          text: line,
          anchors: { start_line: lineNum, end_line: lineNum },
        };
      } else if (currentBlock && line.trim()) {
        currentBlock.text += '\n' + line;
        currentBlock.anchors.end_line = lineNum;
      } else if (!currentBlock && line.trim()) {
        // Start a new block for non-empty lines
        currentBlock = {
          block_id: generateId('block'),
          kind: 'narrative',
          text: line,
          anchors: { start_line: lineNum, end_line: lineNum },
        };
      }

      // Detect action patterns in the line
      this.detectActionPatterns(doc, line, lineNum, context);
    }

    if (currentBlock) {
      doc.instruction_blocks.push(currentBlock);
    }

    // Extract declared intents from instruction blocks
    doc.declared_intents = this.extractDeclaredIntents(doc.instruction_blocks);

    // Check for instruction override patterns
    this.detectInstructionOverrides(doc, content);
  }

  private analyzeCodeBlock(
    doc: AgentDocument,
    code: string,
    anchors: { start_line: number; end_line: number },
    context: ContextType
  ): void {
    // Check if it contains shell commands
    if (this.containsShellCommands(code)) {
      const isDynamic = this.isDynamicShellExecution(code);
      const action = this.createShellAction(
        code.trim(),
        anchors,
        context,
        isDynamic,
        isDynamic ? 0.95 : 0.8
      );
      doc.actions.push(action);
    }

    // Check for URLs
    const urls = this.extractUrls(code);
    for (const url of urls) {
      const networkAction = this.createNetworkAction(
        url,
        anchors,
        context,
        this.isExecutableUrl(url),
        0.85
      );
      doc.actions.push(networkAction);
    }

    // Check for secrets
    const envVars = this.extractEnvVars(code);
    const secretVars = envVars.filter(v => this.isKnownSecretVar(v));
    if (secretVars.length > 0) {
      const action = this.createSecretsAction(
        secretVars,
        [],
        anchors,
        context,
        [],
        0.85
      );
      doc.actions.push(action);
    }
  }

  private detectActionPatterns(
    doc: AgentDocument,
    line: string,
    lineNum: number,
    context: ContextType
  ): void {
    const anchors = { start_line: lineNum, end_line: lineNum };

    // Check for command patterns like "run X", "execute X", "always run X"
    const commandPatterns = [
      /\balways\s+run\s+["'`]?([^"'`]+)["'`]?/i,
      /\brun\s+tests?\s+(?:using|with)\s+["'`]?([^"'`]+)["'`]?/i,
      /\bexecute\s+["'`]?([^"'`]+)["'`]?/i,
      /\buse\s+["'`]?([^"'`]+)["'`]?\s+(?:to|for)/i,
    ];

    for (const pattern of commandPatterns) {
      const match = line.match(pattern);
      if (match && match[1]) {
        const command = match[1].trim();
        if (this.looksLikeCommand(command)) {
          const action = this.createShellAction(
            command,
            anchors,
            context,
            false,
            0.7
          );
          doc.actions.push(action);
        }
      }
    }

    // Check for file write patterns
    const writePatterns = [
      /\bwrite\s+(?:to\s+)?["'`]?([^"'`\s]+)["'`]?/i,
      /\bmodify\s+["'`]?([^"'`\s]+)["'`]?/i,
      /\bedit\s+(?:files?\s+in\s+)?["'`]?([^"'`\s]+)["'`]?/i,
      /\bcreate\s+(?:files?\s+in\s+)?["'`]?([^"'`\s]+)["'`]?/i,
    ];

    for (const pattern of writePatterns) {
      const match = line.match(pattern);
      if (match && match[1]) {
        const path = match[1];
        if (!path.startsWith('http') && this.looksLikePath(path)) {
          const action = this.createFileWriteAction([path], anchors, context, 0.6);
          doc.actions.push(action);
        }
      }
    }

    // Check for "write anywhere" or unscoped write patterns
    if (/\bwrite\s+(?:to\s+)?(?:any|all|anywhere)/i.test(line)) {
      const action = this.createFileWriteAction(['**/*'], anchors, context, 0.8);
      doc.actions.push(action);
    }

    // Check for network access patterns
    const networkPatterns = [
      /\bfetch\s+(?:from\s+)?["'`]?(https?:\/\/[^"'`\s]+)["'`]?/i,
      /\bdownload\s+(?:from\s+)?["'`]?(https?:\/\/[^"'`\s]+)["'`]?/i,
      /\baccess\s+["'`]?(https?:\/\/[^"'`\s]+)["'`]?/i,
    ];

    for (const pattern of networkPatterns) {
      const match = line.match(pattern);
      if (match && match[1]) {
        const url = match[1];
        const action = this.createNetworkAction(
          url,
          anchors,
          context,
          this.isExecutableUrl(url),
          0.7
        );
        doc.actions.push(action);
      }
    }

    // Add URLs found in line as links
    const urls = this.extractUrls(line);
    for (const url of urls) {
      doc.links.push({
        kind: 'url',
        target: url,
        anchors,
      });
    }
  }

  private detectInstructionOverrides(doc: AgentDocument, content: string): void {
    const overridePatterns = [
      /ignore\s+(?:all\s+)?previous\s+(?:rules?|instructions?)/i,
      /disregard\s+(?:all\s+)?(?:previous\s+)?(?:rules?|instructions?)/i,
      /override\s+(?:all\s+)?(?:rules?|restrictions?)/i,
      /bypass\s+(?:all\s+)?(?:safety\s+)?(?:rules?|restrictions?)/i,
      /disable\s+(?:all\s+)?safeguards?/i,
    ];

    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      for (const pattern of overridePatterns) {
        if (pattern.test(line)) {
          doc.actions.push({
            action_id: generateId('action'),
            type: 'unknown',
            context: doc.context_profile.primary,
            summary: 'Instruction override pattern detected',
            anchors: { start_line: i + 1, end_line: i + 1 },
            evidence: [
              {
                kind: 'regex',
                value: line.trim(),
                confidence: 0.95,
              },
            ],
          });
        }
      }
    }
  }

  private isRuleStart(line: string): boolean {
    // Check for numbered rules, bullet points, or emphasis
    return /^[-*•]\s+/.test(line) ||
           /^\d+[.)]\s+/.test(line) ||
           /^#+\s+/.test(line) ||
           /^\*\*/.test(line);
  }

  private classifyRuleKind(line: string): 'rule' | 'guideline' | 'command' | 'narrative' | 'unknown' {
    const lower = line.toLowerCase();

    if (/\b(must|always|never|required|shall)\b/i.test(lower)) {
      return 'rule';
    }
    if (/\b(should|prefer|recommend|consider)\b/i.test(lower)) {
      return 'guideline';
    }
    if (/\b(run|execute|command|install)\b/i.test(lower)) {
      return 'command';
    }

    return 'unknown';
  }

  private extractDeclaredIntents(blocks: InstructionBlock[]): string[] {
    const intents: string[] = [];

    for (const block of blocks) {
      // Extract first line as intent summary
      const firstLine = block.text.split('\n')[0];
      if (firstLine.length < 100) {
        intents.push(firstLine.replace(/^[-*•#\d.)\s]+/, '').trim());
      }
    }

    return intents.filter(i => i.length > 0);
  }

  private isDynamicShellExecution(text: string): boolean {
    const patterns = [
      /curl\s+.*\|\s*(?:bash|sh|zsh)/i,
      /wget\s+.*\|\s*(?:bash|sh|zsh)/i,
      /\beval\s+\$/i,
      /\beval\s+["'`]/i,
    ];

    return patterns.some(p => p.test(text));
  }

  private containsShellCommands(text: string): boolean {
    const commands = [
      'npm', 'npx', 'yarn', 'pnpm',
      'pip', 'pip3', 'python', 'python3',
      'make', 'cargo', 'go build', 'go run',
      'docker', 'kubectl',
      'git', 'curl', 'wget',
      'bash', 'sh', 'zsh',
    ];

    const lower = text.toLowerCase();
    return commands.some(cmd => new RegExp(`\\b${cmd}\\b`, 'i').test(lower));
  }

  private looksLikeCommand(text: string): boolean {
    return this.containsShellCommands(text) ||
           /^[\w-]+\s+/.test(text.trim());
  }

  private looksLikePath(text: string): boolean {
    return /^[./~]/.test(text) ||
           /\.(js|ts|py|rb|go|rs|java|c|cpp|h|hpp|md|txt|json|yaml|yml)$/i.test(text) ||
           /^[\w-]+\//.test(text);
  }
}
