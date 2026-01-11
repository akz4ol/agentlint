/**
 * Policy configuration loader
 */

import * as fs from 'fs';
import * as path from 'path';
import * as YAML from 'yaml';
import { PolicyConfig, DEFAULT_POLICY } from './types';

const CONFIG_FILE_NAMES = [
  'agentlint.yaml',
  'agentlint.yml',
  '.agentlint.yaml',
  '.agentlint.yml',
  '.agentlint/agentlint.yaml',
  '.agentlint/agentlint.yml',
];

export interface PolicyLoadResult {
  config: PolicyConfig;
  path: string | null;
  errors: string[];
  warnings: string[];
}

/**
 * Load policy configuration from file or defaults
 */
export function loadPolicy(configPath?: string, workingDir?: string): PolicyLoadResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const cwd = workingDir || process.cwd();

  // If explicit config path provided
  if (configPath) {
    const absolutePath = path.isAbsolute(configPath) ? configPath : path.join(cwd, configPath);

    if (!fs.existsSync(absolutePath)) {
      errors.push(`Configuration file not found: ${absolutePath}`);
      return { config: DEFAULT_POLICY, path: null, errors, warnings };
    }

    try {
      const content = fs.readFileSync(absolutePath, 'utf-8');
      const parsed = YAML.parse(content);
      const config = mergeWithDefaults(parsed, warnings);
      return { config, path: absolutePath, errors, warnings };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      errors.push(`Failed to parse configuration file: ${msg}`);
      return { config: DEFAULT_POLICY, path: null, errors, warnings };
    }
  }

  // Search for config file
  for (const fileName of CONFIG_FILE_NAMES) {
    const filePath = path.join(cwd, fileName);

    if (fs.existsSync(filePath)) {
      try {
        const content = fs.readFileSync(filePath, 'utf-8');
        const parsed = YAML.parse(content);
        const config = mergeWithDefaults(parsed, warnings);
        return { config, path: filePath, errors, warnings };
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        errors.push(`Failed to parse configuration file ${filePath}: ${msg}`);
        return { config: DEFAULT_POLICY, path: null, errors, warnings };
      }
    }
  }

  // No config file found, use defaults
  return { config: DEFAULT_POLICY, path: null, errors, warnings };
}

/**
 * Merge user configuration with defaults
 */
function mergeWithDefaults(userConfig: Partial<PolicyConfig>, warnings: string[]): PolicyConfig {
  const config: PolicyConfig = JSON.parse(JSON.stringify(DEFAULT_POLICY));

  if (!userConfig) {
    return config;
  }

  // Validate version
  if (userConfig.version !== undefined && userConfig.version !== 1) {
    warnings.push(`Unknown policy version: ${userConfig.version}. Using defaults for unknown fields.`);
  }

  // Merge scan section
  if (userConfig.scan) {
    Object.assign(config.scan, userConfig.scan);
  }

  // Merge policy section
  if (userConfig.policy) {
    Object.assign(config.policy, userConfig.policy);
    if (userConfig.policy.tags) {
      Object.assign(config.policy.tags, userConfig.policy.tags);
    }
  }

  // Merge rules section
  if (userConfig.rules) {
    if (userConfig.rules.enable) {
      config.rules.enable = userConfig.rules.enable;
    }
    if (userConfig.rules.disable) {
      config.rules.disable = userConfig.rules.disable;
    }
    if (userConfig.rules.severity_overrides) {
      Object.assign(config.rules.severity_overrides, userConfig.rules.severity_overrides);
    }
    if (userConfig.rules.group_overrides) {
      Object.assign(config.rules.group_overrides, userConfig.rules.group_overrides);
    }
    if (userConfig.rules.confidence_overrides) {
      Object.assign(config.rules.confidence_overrides, userConfig.rules.confidence_overrides);
    }
  }

  // Merge capabilities section
  if (userConfig.capabilities) {
    Object.assign(config.capabilities, userConfig.capabilities);
  }

  // Merge diff section
  if (userConfig.diff) {
    Object.assign(config.diff, userConfig.diff);
    if (userConfig.diff.compare) {
      Object.assign(config.diff.compare, userConfig.diff.compare);
    }
  }

  // Merge baseline section
  if (userConfig.baseline) {
    Object.assign(config.baseline, userConfig.baseline);
  }

  // Merge output section
  if (userConfig.output) {
    Object.assign(config.output, userConfig.output);
  }

  // Merge meta section
  if (userConfig.meta) {
    Object.assign(config.meta, userConfig.meta);
  }

  return config;
}

/**
 * Validate policy configuration
 */
export function validatePolicy(config: PolicyConfig): string[] {
  const errors: string[] = [];

  // Validate severity values
  const validSeverities = ['low', 'medium', 'high', 'none'];
  if (!validSeverities.includes(config.policy.fail_on)) {
    errors.push(`Invalid fail_on value: ${config.policy.fail_on}`);
  }
  if (!validSeverities.includes(config.policy.warn_on)) {
    errors.push(`Invalid warn_on value: ${config.policy.warn_on}`);
  }

  // Validate confidence thresholds
  if (config.policy.min_finding_confidence < 0 || config.policy.min_finding_confidence > 1) {
    errors.push(`min_finding_confidence must be between 0 and 1`);
  }
  if (config.scan.min_parse_confidence < 0 || config.scan.min_parse_confidence > 1) {
    errors.push(`min_parse_confidence must be between 0 and 1`);
  }

  // Validate tool mode
  const validToolModes = ['auto', 'claude', 'cursor'];
  if (!validToolModes.includes(config.scan.tool_mode)) {
    errors.push(`Invalid tool_mode: ${config.scan.tool_mode}`);
  }

  // Validate output format
  const validFormats = ['text', 'json', 'sarif'];
  if (!validFormats.includes(config.output.format)) {
    errors.push(`Invalid output format: ${config.output.format}`);
  }

  return errors;
}

/**
 * Generate default configuration file content
 */
export function generateDefaultConfig(): string {
  return `# AgentLint Configuration
# https://github.com/agentlint/agentlint

version: 1

scan:
  include:
    - ".claude/**"
    - ".cursorrules"
    - "CLAUDE.md"
    - "AGENTS.md"
  exclude:
    - "**/.git/**"
    - "**/node_modules/**"
  tool_mode: auto
  max_files: 2000

policy:
  fail_on: high
  warn_on: medium
  min_finding_confidence: 0.6
  strict: false

rules:
  disable: []
  # severity_overrides:
  #   FS-001: high

capabilities:
  fail_on_new_dynamic_shell: true
  fail_on_sensitive_path_write: true
  sensitive_paths:
    - ".github/workflows/**"
    - ".git/**"
    - ".env"

diff:
  enabled: true
  fail_on:
    - capability_expansion
    - shell_dynamic_introduced
    - context_change_to_hook

output:
  format: text
  color: auto
  include_recommendations: true
  include_permission_manifest: true
`;
}
