/**
 * Policy configuration types
 */

import { Severity } from '../ir/types';

export interface PolicyConfig {
  version: number;

  scan: {
    root?: string;
    include: string[];
    exclude: string[];
    tool_mode: 'auto' | 'claude' | 'cursor';
    max_files: number;
    timeout: string;
    min_parse_confidence: number;
  };

  policy: {
    ci_mode: boolean;
    fail_on: Severity | 'none';
    warn_on: Severity | 'none';
    min_finding_confidence: number;
    treat_parse_failed_as: 'pass' | 'warn' | 'fail';
    no_supported_files_as: 'pass' | 'warn' | 'fail';
    strict: boolean;
    tags: {
      fail_if_any: string[];
      warn_if_any: string[];
      ignore_if_any: string[];
    };
  };

  rules: {
    enable: string[];
    disable: string[];
    severity_overrides: Record<string, Severity>;
    group_overrides: Record<string, Severity>;
    confidence_overrides: Record<string, number>;
  };

  capabilities: {
    fail_on_expansion: boolean;
    fail_on_new_dynamic_shell: boolean;
    fail_on_new_network_outbound: boolean;
    fail_on_sensitive_path_write: boolean;
    sensitive_paths: string[];
    allowed_write_scopes: string[];
    disallowed_write_scopes: string[];
    allowed_network_domains: string[];
    disallowed_network_domains: string[];
  };

  diff: {
    enabled: boolean;
    fail_on: string[];
    warn_on: string[];
    compare: {
      normalize_globs: boolean;
      normalize_domains: boolean;
      normalize_commands: boolean;
    };
  };

  baseline: {
    enabled: boolean;
    file: string;
    mode: 'suppress_known' | 'require_no_new';
    fingerprint: 'stable' | 'location' | 'content';
    expires_days: number;
  };

  output: {
    format: 'text' | 'json' | 'sarif';
    color: 'auto' | 'always' | 'never';
    include_recommendations: boolean;
    include_permission_manifest: boolean;
    include_ir: boolean;
  };

  meta: {
    policy_name: string;
    owner: string;
    last_reviewed: string;
  };
}

export const DEFAULT_POLICY: PolicyConfig = {
  version: 1,

  scan: {
    root: '.',
    include: [
      '.claude/**',
      '.cursorrules',
      'CLAUDE.md',
      'AGENTS.md',
    ],
    exclude: [
      '**/.git/**',
      '**/node_modules/**',
    ],
    tool_mode: 'auto',
    max_files: 2000,
    timeout: '10s',
    min_parse_confidence: 0.5,
  },

  policy: {
    ci_mode: false,
    fail_on: 'high',
    warn_on: 'medium',
    min_finding_confidence: 0.6,
    treat_parse_failed_as: 'warn',
    no_supported_files_as: 'pass',
    strict: false,
    tags: {
      fail_if_any: [],
      warn_if_any: [],
      ignore_if_any: [],
    },
  },

  rules: {
    enable: [],
    disable: [],
    severity_overrides: {},
    group_overrides: {},
    confidence_overrides: {},
  },

  capabilities: {
    fail_on_expansion: true,
    fail_on_new_dynamic_shell: true,
    fail_on_new_network_outbound: false,
    fail_on_sensitive_path_write: true,
    sensitive_paths: [
      '.github/workflows/**',
      '.git/**',
      '.env',
      '~/.ssh/**',
    ],
    allowed_write_scopes: [],
    disallowed_write_scopes: [],
    allowed_network_domains: [],
    disallowed_network_domains: [],
  },

  diff: {
    enabled: true,
    fail_on: [
      'capability_expansion',
      'context_change_to_hook',
      'write_scope_widening_to_all',
    ],
    warn_on: [
      'new_medium_findings',
    ],
    compare: {
      normalize_globs: true,
      normalize_domains: true,
      normalize_commands: true,
    },
  },

  baseline: {
    enabled: false,
    file: '.agentlint/baseline.json',
    mode: 'suppress_known',
    fingerprint: 'stable',
    expires_days: 30,
  },

  output: {
    format: 'text',
    color: 'auto',
    include_recommendations: true,
    include_permission_manifest: true,
    include_ir: false,
  },

  meta: {
    policy_name: 'default',
    owner: '',
    last_reviewed: '',
  },
};
