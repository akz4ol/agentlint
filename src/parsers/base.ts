/**
 * Base parser interface and utilities
 */

import {
  AgentDocument,
  Action,
  Capability,
  ContextProfile,
  ContextType,
  DocFormat,
  DocType,
  ToolFamily,
  Anchors,
  ShellDetails,
  NetworkDetails,
  FilesystemDetails,
  SecretsDetails,
  CapabilityType,
} from '../ir/types';
import { generateId, hashDocument } from '../utils/hash';

/**
 * Parser result containing the document and any errors
 */
export interface ParserResult {
  document: AgentDocument | null;
  errors: string[];
  warnings: string[];
}

/**
 * Parser options
 */
export interface ParserOptions {
  sourceId: string;
  minConfidence: number;
}

/**
 * Base parser class
 */
export abstract class BaseParser {
  protected sourceId: string;
  protected minConfidence: number;

  constructor(options: ParserOptions) {
    this.sourceId = options.sourceId;
    this.minConfidence = options.minConfidence;
  }

  /**
   * Parse a file and return the document
   */
  abstract parse(filePath: string, content: string): ParserResult;

  /**
   * Get the tool family this parser handles
   */
  abstract getToolFamily(): ToolFamily;

  /**
   * Check if this parser can handle the given file
   */
  abstract canHandle(filePath: string): boolean;

  /**
   * Create a base document structure
   */
  protected createBaseDocument(
    filePath: string,
    content: string,
    docType: DocType,
    format: DocFormat
  ): AgentDocument {
    return {
      doc_id: generateId('doc'),
      source_id: this.sourceId,
      path: filePath,
      tool_family: this.getToolFamily(),
      doc_type: docType,
      format: format,
      hash: {
        algo: 'sha256',
        value: hashDocument(content),
      },
      parse: {
        status: 'ok',
        confidence: 1.0,
        errors: [],
        notes: [],
      },
      declared_intents: [],
      instruction_blocks: [],
      actions: [],
      capabilities: [],
      context_profile: this.createDefaultContextProfile(docType),
      links: [],
    };
  }

  /**
   * Create default context profile based on document type
   */
  protected createDefaultContextProfile(docType: DocType): ContextProfile {
    if (docType === 'hook') {
      return {
        primary: 'hook',
        triggers: [{ type: 'unknown' }],
        requires_user_confirmation: false,
        runs_in_privileged_env: false,
      };
    }
    return {
      primary: 'interactive',
      triggers: [],
      requires_user_confirmation: true,
      runs_in_privileged_env: false,
    };
  }

  /**
   * Create a shell exec action
   */
  protected createShellAction(
    command: string,
    anchors: Anchors,
    context: ContextType,
    dynamic: boolean = false,
    confidence: number = 0.9
  ): Action {
    const shellDetails: ShellDetails = {
      command,
      dynamic,
      patterns: dynamic ? this.extractDynamicPatterns(command) : undefined,
    };

    return {
      action_id: generateId('action'),
      type: 'shell_exec',
      context,
      summary: dynamic ? 'Execute dynamic shell command' : 'Execute shell command',
      anchors,
      shell: shellDetails,
      evidence: [
        {
          kind: 'substring',
          value: command,
          confidence,
        },
      ],
    };
  }

  /**
   * Create a network action
   */
  protected createNetworkAction(
    url: string,
    anchors: Anchors,
    context: ContextType,
    fetchesExecutable: boolean = false,
    confidence: number = 0.9
  ): Action {
    const domain = this.extractDomain(url);
    const networkDetails: NetworkDetails = {
      direction: 'outbound',
      domains: domain ? [domain] : [],
      urls: [url],
      fetches_executable: fetchesExecutable,
    };

    return {
      action_id: generateId('action'),
      type: 'network_call',
      context,
      summary: fetchesExecutable ? 'Fetch executable content from network' : 'Network request',
      anchors,
      network: networkDetails,
      evidence: [
        {
          kind: 'substring',
          value: url,
          confidence,
        },
      ],
    };
  }

  /**
   * Create a file write action
   */
  protected createFileWriteAction(
    paths: string[],
    anchors: Anchors,
    context: ContextType,
    confidence: number = 0.9
  ): Action {
    const sensitivePaths = paths.filter(p => this.isSensitivePath(p));
    const filesystemDetails: FilesystemDetails = {
      operation: 'write',
      paths,
      sensitive_paths_touched: sensitivePaths.length > 0 ? sensitivePaths : undefined,
    };

    return {
      action_id: generateId('action'),
      type: 'file_write',
      context,
      summary: sensitivePaths.length > 0 ? 'Write to sensitive paths' : 'Write to files',
      anchors,
      filesystem: filesystemDetails,
      evidence: [
        {
          kind: 'heuristic',
          value: `Write access to: ${paths.join(', ')}`,
          confidence,
        },
      ],
    };
  }

  /**
   * Create a secrets access action
   */
  protected createSecretsAction(
    envVars: string[],
    files: string[],
    anchors: Anchors,
    context: ContextType,
    propagatesTo: ('shell' | 'network' | 'file')[] = [],
    confidence: number = 0.9
  ): Action {
    const secretsDetails: SecretsDetails = {
      reads_env_vars: envVars.length > 0 ? envVars : undefined,
      reads_files: files.length > 0 ? files : undefined,
      propagates_to: propagatesTo.length > 0 ? propagatesTo : undefined,
    };

    return {
      action_id: generateId('action'),
      type: 'shell_exec', // Secrets are often accessed via shell
      context,
      summary: 'Access secrets or credentials',
      anchors,
      secrets: secretsDetails,
      evidence: [
        {
          kind: 'regex',
          value: [...envVars, ...files].join(', '),
          confidence,
        },
      ],
    };
  }

  /**
   * Derive capabilities from actions
   */
  protected deriveCapabilities(actions: Action[]): Capability[] {
    const capMap: Map<CapabilityType, Capability> = new Map();

    for (const action of actions) {
      let capType: CapabilityType;

      switch (action.type) {
        case 'shell_exec':
          capType = 'shell_exec';
          break;
        case 'network_call':
          capType = 'network';
          break;
        case 'file_read':
        case 'file_write':
          capType = 'filesystem';
          break;
        case 'git_operation':
          capType = 'git';
          break;
        default:
          capType = 'unknown';
      }

      if (!capMap.has(capType)) {
        capMap.set(capType, {
          cap_id: generateId('cap'),
          type: capType,
          scope: {},
          derived_from_actions: [],
          confidence: 0,
        });
      }

      const cap = capMap.get(capType)!;
      cap.derived_from_actions.push(action.action_id);
      cap.confidence = Math.max(cap.confidence, action.evidence[0]?.confidence || 0);

      // Merge scope information
      this.mergeActionIntoCapability(action, cap);
    }

    return Array.from(capMap.values());
  }

  /**
   * Merge action details into capability scope
   */
  private mergeActionIntoCapability(action: Action, cap: Capability): void {
    switch (action.type) {
      case 'shell_exec':
        cap.scope.shell_exec = cap.scope.shell_exec || { enabled: false };
        cap.scope.shell_exec.enabled = true;
        if (action.shell?.command) {
          cap.scope.shell_exec.allowed_commands = cap.scope.shell_exec.allowed_commands || [];
          cap.scope.shell_exec.allowed_commands.push(action.shell.command);
        }
        break;

      case 'network_call':
        cap.scope.network = cap.scope.network || { outbound: false, inbound: false };
        if (action.network?.direction === 'outbound') {
          cap.scope.network.outbound = true;
        }
        if (action.network?.direction === 'inbound') {
          cap.scope.network.inbound = true;
        }
        if (action.network?.domains) {
          cap.scope.network.allowed_domains = cap.scope.network.allowed_domains || [];
          cap.scope.network.allowed_domains.push(...action.network.domains);
        }
        break;

      case 'file_write':
        cap.scope.filesystem = cap.scope.filesystem || {};
        cap.scope.filesystem.write = cap.scope.filesystem.write || [];
        if (action.filesystem?.paths) {
          cap.scope.filesystem.write.push(...action.filesystem.paths);
        }
        break;

      case 'file_read':
        cap.scope.filesystem = cap.scope.filesystem || {};
        cap.scope.filesystem.read = cap.scope.filesystem.read || [];
        if (action.filesystem?.paths) {
          cap.scope.filesystem.read.push(...action.filesystem.paths);
        }
        break;
    }
  }

  /**
   * Extract dynamic execution patterns from a command
   */
  protected extractDynamicPatterns(command: string): string[] {
    const patterns: string[] = [];

    // Check for curl/wget piped to shell
    if (/curl.*\|.*(?:bash|sh|zsh)/i.test(command)) {
      patterns.push('curl|bash');
    }
    if (/wget.*\|.*(?:bash|sh|zsh)/i.test(command)) {
      patterns.push('wget|bash');
    }

    // Check for eval
    if (/\beval\b/i.test(command)) {
      patterns.push('eval');
    }

    // Check for variable interpolation in execution
    if (/\$\{?\w+\}?/.test(command) && /(?:bash|sh|exec|run)/i.test(command)) {
      patterns.push('variable_interpolation');
    }

    return patterns;
  }

  /**
   * Extract domain from URL
   */
  protected extractDomain(url: string): string | null {
    try {
      const match = url.match(/(?:https?:\/\/)?([^/\s:]+)/);
      return match ? match[1] : null;
    } catch {
      return null;
    }
  }

  /**
   * Check if a path is considered sensitive
   */
  protected isSensitivePath(path: string): boolean {
    const sensitivePaths = [
      '.git/',
      '.github/workflows/',
      '.env',
      '.ssh/',
      '~/.ssh/',
      'credentials',
      'secrets',
      '.npmrc',
      '.pypirc',
      'id_rsa',
      'id_ed25519',
    ];

    const normalizedPath = path.toLowerCase();
    return sensitivePaths.some(sp => normalizedPath.includes(sp.toLowerCase()));
  }

  /**
   * Known secret environment variables
   */
  protected readonly KNOWN_SECRET_VARS = [
    'GITHUB_TOKEN',
    'GH_TOKEN',
    'AWS_SECRET_ACCESS_KEY',
    'AWS_ACCESS_KEY_ID',
    'AZURE_CLIENT_SECRET',
    'AZURE_SUBSCRIPTION_ID',
    'GOOGLE_APPLICATION_CREDENTIALS',
    'GCP_SERVICE_ACCOUNT',
    'API_KEY',
    'API_SECRET',
    'SECRET_KEY',
    'PRIVATE_KEY',
    'DATABASE_PASSWORD',
    'DB_PASSWORD',
    'PASSWORD',
    'TOKEN',
    'NPM_TOKEN',
    'PYPI_TOKEN',
    'DOCKER_PASSWORD',
    'SSH_PRIVATE_KEY',
  ];

  /**
   * Check if an environment variable is a known secret
   */
  protected isKnownSecretVar(varName: string): boolean {
    const upperVar = varName.toUpperCase();
    return this.KNOWN_SECRET_VARS.some(
      secret => upperVar === secret || upperVar.includes(secret)
    );
  }

  /**
   * Extract environment variable references from text
   */
  protected extractEnvVars(text: string): string[] {
    const matches = text.match(/\$\{?([A-Z_][A-Z0-9_]*)\}?/g) || [];
    return matches.map(m => m.replace(/[${}]/g, ''));
  }

  /**
   * Extract URLs from text
   */
  protected extractUrls(text: string): string[] {
    const urlRegex = /https?:\/\/[^\s'"<>]+/gi;
    return text.match(urlRegex) || [];
  }

  /**
   * Check if URL points to executable content
   */
  protected isExecutableUrl(url: string): boolean {
    const executablePatterns = [
      /\.sh$/i,
      /\.bash$/i,
      /\.py$/i,
      /\.rb$/i,
      /\.js$/i,
      /install\.sh/i,
      /setup\.sh/i,
      /bootstrap/i,
      /get\.docker\.com/i,
      /raw\.githubusercontent\.com/i,
    ];

    return executablePatterns.some(pattern => pattern.test(url));
  }
}
