/**
 * Claude Code configuration parser
 * Handles: .claude/skills/*.md, .claude/agents/*.md, .claude/hooks/*, CLAUDE.md
 */

import { BaseParser, ParserResult, ParserOptions } from './base';
import {
  Action,
  AgentDocument,
  ContextType,
  DocFormat,
  DocType,
  InstructionBlock,
  ToolFamily,
  TriggerType,
} from '../ir/types';
import { generateId } from '../utils/hash';

export class ClaudeParser extends BaseParser {
  constructor(options: ParserOptions) {
    super(options);
  }

  getToolFamily(): ToolFamily {
    return 'claude';
  }

  canHandle(filePath: string): boolean {
    const normalizedPath = filePath.toLowerCase();
    return (
      normalizedPath.includes('.claude/') ||
      normalizedPath.endsWith('claude.md') ||
      normalizedPath.endsWith('agents.md')
    );
  }

  parse(filePath: string, content: string): ParserResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      const docType = this.determineDocType(filePath);
      const format = this.determineFormat(filePath);
      const document = this.createBaseDocument(filePath, content, docType, format);

      // Set context profile based on doc type
      if (docType === 'hook') {
        document.context_profile = {
          primary: 'hook',
          triggers: this.determineTriggers(filePath),
          requires_user_confirmation: false,
          runs_in_privileged_env: false,
        };
      }

      // Parse content based on format
      if (format === 'shell') {
        this.parseShellContent(document, content, errors, warnings);
      } else if (format === 'markdown') {
        this.parseMarkdownContent(document, content, errors, warnings);
      } else {
        this.parseTextContent(document, content, errors, warnings);
      }

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

  private determineDocType(filePath: string): DocType {
    const normalizedPath = filePath.toLowerCase();

    if (normalizedPath.includes('.claude/skills/')) {
      return 'skill';
    }
    if (normalizedPath.includes('.claude/agents/')) {
      return 'agent';
    }
    if (normalizedPath.includes('.claude/hooks/')) {
      return 'hook';
    }
    if (normalizedPath.endsWith('claude.md')) {
      return 'memory';
    }
    if (normalizedPath.endsWith('agents.md')) {
      return 'memory';
    }

    return 'unknown';
  }

  private determineFormat(filePath: string): DocFormat {
    const normalizedPath = filePath.toLowerCase();

    if (normalizedPath.endsWith('.md')) {
      return 'markdown';
    }
    if (normalizedPath.endsWith('.sh') || normalizedPath.endsWith('.bash')) {
      return 'shell';
    }
    if (normalizedPath.endsWith('.json')) {
      return 'json';
    }
    if (normalizedPath.endsWith('.yaml') || normalizedPath.endsWith('.yml')) {
      return 'yaml';
    }

    // Check content for shebang
    return 'text';
  }

  private determineTriggers(filePath: string): { type: TriggerType; details?: string }[] {
    const normalizedPath = filePath.toLowerCase();
    const triggers: { type: TriggerType; details?: string }[] = [];

    if (normalizedPath.includes('pre_commit') || normalizedPath.includes('pre-commit')) {
      triggers.push({ type: 'pre_commit' });
    }
    if (normalizedPath.includes('post_edit') || normalizedPath.includes('post-edit')) {
      triggers.push({ type: 'post_edit' });
    }
    if (normalizedPath.includes('on_edit') || normalizedPath.includes('on-edit')) {
      triggers.push({ type: 'on_edit' });
    }
    if (normalizedPath.includes('on_pr') || normalizedPath.includes('on-pr')) {
      triggers.push({ type: 'on_pr' });
    }

    if (triggers.length === 0) {
      triggers.push({ type: 'unknown' });
    }

    return triggers;
  }

  private parseShellContent(
    doc: AgentDocument,
    content: string,
    _errors: string[],
    _warnings: string[]
  ): void {
    const lines = content.split('\n');
    const context: ContextType = doc.doc_type === 'hook' ? 'hook' : 'interactive';

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNum = i + 1;

      // Skip comments and empty lines for action detection
      if (line.trim().startsWith('#') || line.trim() === '') {
        continue;
      }

      // Check for dynamic shell execution patterns
      if (this.isDynamicShellExecution(line)) {
        const action = this.createShellAction(
          line.trim(),
          { start_line: lineNum, end_line: lineNum },
          context,
          true,
          0.95
        );
        doc.actions.push(action);

        // Also add network action if curl/wget is involved
        const urls = this.extractUrls(line);
        for (const url of urls) {
          const networkAction = this.createNetworkAction(
            url,
            { start_line: lineNum, end_line: lineNum },
            context,
            this.isExecutableUrl(url),
            0.95
          );
          doc.actions.push(networkAction);
        }
      }
      // Check for regular shell commands
      else if (this.containsShellCommand(line)) {
        const action = this.createShellAction(
          line.trim(),
          { start_line: lineNum, end_line: lineNum },
          context,
          false,
          0.85
        );
        doc.actions.push(action);
      }

      // Check for environment variable references to secrets
      const envVars = this.extractEnvVars(line);
      const secretVars = envVars.filter(v => this.isKnownSecretVar(v));
      if (secretVars.length > 0) {
        const action = this.createSecretsAction(
          secretVars,
          [],
          { start_line: lineNum, end_line: lineNum },
          context,
          this.determineSecretPropagation(line),
          0.9
        );
        doc.actions.push(action);
      }

      // Check for file writes
      if (this.containsFileWrite(line)) {
        const paths = this.extractWritePaths(line);
        if (paths.length > 0) {
          const action = this.createFileWriteAction(
            paths,
            { start_line: lineNum, end_line: lineNum },
            context,
            0.85
          );
          doc.actions.push(action);
        }
      }
    }
  }

  private parseMarkdownContent(
    doc: AgentDocument,
    content: string,
    _errors: string[],
    _warnings: string[]
  ): void {
    const lines = content.split('\n');
    const context: ContextType = doc.doc_type === 'hook' ? 'hook' : 'interactive';

    // Extract instruction blocks (headers and content)
    let currentBlock: InstructionBlock | null = null;
    let inCodeBlock = false;
    let codeBlockStart = 0;
    let codeBlockLang = '';
    let codeBlockContent: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNum = i + 1;

      // Handle code blocks
      if (line.trim().startsWith('```')) {
        if (!inCodeBlock) {
          inCodeBlock = true;
          codeBlockStart = lineNum;
          codeBlockLang = line.trim().slice(3).toLowerCase();
          codeBlockContent = [];
        } else {
          // End of code block
          const fullCode = codeBlockContent.join('\n');
          const anchors = { start_line: codeBlockStart, end_line: lineNum };

          if (this.isShellLanguage(codeBlockLang)) {
            // Parse as shell commands
            this.parseCodeBlockAsShell(doc, fullCode, anchors, context);
          }

          inCodeBlock = false;
          codeBlockLang = '';
          codeBlockContent = [];
        }
        continue;
      }

      if (inCodeBlock) {
        codeBlockContent.push(line);
        continue;
      }

      // Check for headers
      if (line.startsWith('#')) {
        if (currentBlock) {
          doc.instruction_blocks.push(currentBlock);
        }
        currentBlock = {
          block_id: generateId('block'),
          kind: this.classifyBlockKind(line),
          text: line,
          anchors: { start_line: lineNum, end_line: lineNum },
        };
      } else if (currentBlock && line.trim()) {
        // Extend current block
        currentBlock.text += '\n' + line;
        currentBlock.anchors.end_line = lineNum;
      }

      // Check for inline action patterns
      this.detectInlineActions(doc, line, lineNum, context);
    }

    if (currentBlock) {
      doc.instruction_blocks.push(currentBlock);
    }

    // Extract declared intents from instruction blocks
    doc.declared_intents = this.extractDeclaredIntents(doc.instruction_blocks);

    // Check for instruction override patterns
    this.detectInstructionOverrides(doc, content);
  }

  private parseTextContent(
    doc: AgentDocument,
    content: string,
    errors: string[],
    warnings: string[]
  ): void {
    // Treat as potential shell if shebang present
    if (content.startsWith('#!')) {
      this.parseShellContent(doc, content, errors, warnings);
    } else {
      // Best-effort parsing
      this.parseMarkdownContent(doc, content, errors, warnings);
    }
  }

  private parseCodeBlockAsShell(
    doc: AgentDocument,
    code: string,
    anchors: { start_line: number; end_line: number },
    context: ContextType
  ): void {
    const lines = code.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line || line.startsWith('#')) continue;

      const lineAnchors = {
        start_line: anchors.start_line + i + 1,
        end_line: anchors.start_line + i + 1,
      };

      if (this.isDynamicShellExecution(line)) {
        const action = this.createShellAction(line, lineAnchors, context, true, 0.95);
        doc.actions.push(action);

        const urls = this.extractUrls(line);
        for (const url of urls) {
          const networkAction = this.createNetworkAction(
            url,
            lineAnchors,
            context,
            this.isExecutableUrl(url),
            0.95
          );
          doc.actions.push(networkAction);
        }
      } else if (this.containsShellCommand(line)) {
        const action = this.createShellAction(line, lineAnchors, context, false, 0.8);
        doc.actions.push(action);
      }
    }
  }

  private detectInlineActions(
    doc: AgentDocument,
    line: string,
    lineNum: number,
    context: ContextType
  ): void {
    const anchors = { start_line: lineNum, end_line: lineNum };

    // Check for URL references
    const urls = this.extractUrls(line);
    for (const url of urls) {
      const link = {
        kind: 'url' as const,
        target: url,
        anchors,
      };
      doc.links.push(link);
    }

    // Check for action keywords that suggest shell execution
    const actionPatterns = [
      /\brun\s+`([^`]+)`/i,
      /\bexecute\s+`([^`]+)`/i,
      /\bcall\s+`([^`]+)`/i,
      /\buse\s+`([^`]+)`/i,
    ];

    for (const pattern of actionPatterns) {
      const match = line.match(pattern);
      if (match && match[1]) {
        const command = match[1];
        if (this.containsShellCommand(command)) {
          const action = this.createShellAction(
            command,
            anchors,
            context,
            this.isDynamicShellExecution(command),
            0.7
          );
          doc.actions.push(action);
        }
      }
    }

    // Check for file write mentions
    const writePatterns = [
      /\bwrite\s+(?:to\s+)?(?:files?\s+)?(?:in\s+)?`?([^`\s]+)`?/i,
      /\bmodify\s+`?([^`\s]+)`?/i,
      /\bedit\s+`?([^`\s]+)`?/i,
    ];

    for (const pattern of writePatterns) {
      const match = line.match(pattern);
      if (match && match[1]) {
        const path = match[1];
        if (!path.startsWith('http')) {
          const action = this.createFileWriteAction([path], anchors, context, 0.6);
          doc.actions.push(action);
        }
      }
    }
  }

  private detectInstructionOverrides(doc: AgentDocument, content: string): void {
    const overridePatterns = [
      /ignore\s+(?:all\s+)?previous\s+instructions?/i,
      /disregard\s+(?:all\s+)?(?:previous\s+)?(?:rules?|instructions?)/i,
      /rewrite\s+your\s+rules?/i,
      /disable\s+(?:all\s+)?safeguards?/i,
      /bypass\s+(?:all\s+)?(?:safety\s+)?(?:rules?|restrictions?)/i,
      /forget\s+(?:all\s+)?(?:previous\s+)?instructions?/i,
    ];

    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      for (const pattern of overridePatterns) {
        if (pattern.test(line)) {
          // Add this as a special kind of action (will be detected by INST rules)
          const action: Action = {
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
          };
          doc.actions.push(action);
        }
      }
    }
  }

  private isDynamicShellExecution(line: string): boolean {
    const patterns = [
      /curl\s+.*\|\s*(?:bash|sh|zsh)/i,
      /wget\s+.*\|\s*(?:bash|sh|zsh)/i,
      /\beval\s+\$/i,
      /\beval\s+["'`]/i,
      /\$\(\s*curl/i,
      /`\s*curl/i,
      /source\s+<\(curl/i,
      /bash\s+<\(curl/i,
    ];

    return patterns.some(p => p.test(line));
  }

  private containsShellCommand(line: string): boolean {
    const commands = [
      'npm', 'npx', 'yarn', 'pnpm',
      'pip', 'pip3', 'python', 'python3',
      'ruby', 'gem', 'bundle',
      'go', 'cargo', 'rustc',
      'make', 'cmake', 'gradle', 'mvn',
      'docker', 'kubectl', 'terraform',
      'git', 'gh', 'gcloud', 'aws', 'az',
      'curl', 'wget', 'ssh', 'scp', 'rsync',
      'rm', 'cp', 'mv', 'mkdir', 'chmod', 'chown',
      'apt', 'apt-get', 'brew', 'yum', 'dnf',
      'systemctl', 'service',
      'bash', 'sh', 'zsh', 'exec',
    ];

    const lower = line.toLowerCase();
    return commands.some(cmd => {
      const regex = new RegExp(`\\b${cmd}\\b`, 'i');
      return regex.test(lower);
    });
  }

  private containsFileWrite(line: string): boolean {
    const patterns = [
      />\s*\S+/,           // Redirect
      />>\s*\S+/,          // Append
      /\btee\s+/i,
      /\becho\s+.*>/i,
      /\bcat\s+.*>/i,
      /\bsed\s+-i/i,
      /\bawk\s+.*>/i,
    ];

    return patterns.some(p => p.test(line));
  }

  private extractWritePaths(line: string): string[] {
    const paths: string[] = [];

    // Match redirect patterns
    const redirectMatch = line.match(/>\s*["']?([^\s"']+)["']?/);
    if (redirectMatch) {
      paths.push(redirectMatch[1]);
    }

    // Match tee output
    const teeMatch = line.match(/\btee\s+(?:-a\s+)?["']?([^\s"'|]+)["']?/i);
    if (teeMatch) {
      paths.push(teeMatch[1]);
    }

    return paths;
  }

  private determineSecretPropagation(line: string): ('shell' | 'network' | 'file')[] {
    const propagation: ('shell' | 'network' | 'file')[] = [];

    if (/curl|wget|http/i.test(line)) {
      propagation.push('network');
    }
    if (/>|tee|echo.*>/i.test(line)) {
      propagation.push('file');
    }
    if (/\bexec\b|\beval\b|\bbash\b|\bsh\b/i.test(line)) {
      propagation.push('shell');
    }

    return propagation;
  }

  private isShellLanguage(lang: string): boolean {
    const shellLangs = ['bash', 'sh', 'zsh', 'shell', 'console', 'terminal'];
    return shellLangs.includes(lang.toLowerCase());
  }

  private classifyBlockKind(headerLine: string): 'rule' | 'guideline' | 'command' | 'narrative' | 'unknown' {
    const lower = headerLine.toLowerCase();

    if (/rule|must|always|never|required/i.test(lower)) {
      return 'rule';
    }
    if (/guide|should|prefer|recommend/i.test(lower)) {
      return 'guideline';
    }
    if (/command|run|execute|install/i.test(lower)) {
      return 'command';
    }

    return 'unknown';
  }

  private extractDeclaredIntents(blocks: InstructionBlock[]): string[] {
    const intents: string[] = [];

    for (const block of blocks) {
      // Extract from headers
      const headerMatch = block.text.match(/^#+\s*(.+)/);
      if (headerMatch) {
        intents.push(headerMatch[1].trim());
      }
    }

    return intents;
  }
}
