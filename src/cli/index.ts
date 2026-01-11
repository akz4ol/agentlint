#!/usr/bin/env node
/**
 * AgentLint CLI
 * Static analysis and security scanner for AI agent configuration files
 */

import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import { Scanner } from '../scanner';
import { loadPolicy, validatePolicy, generateDefaultConfig } from '../policy/loader';
import { RuleEngine } from '../rules/engine';
import { generateReport, generateDiffReport } from '../reports';
import { ReportOptions, ReportFormat } from '../reports/types';
import { compareScanResults } from '../diff';

const VERSION = '0.1.0';

const program = new Command();

program
  .name('agentlint')
  .description('Static analysis and security scanner for AI agent configuration files')
  .version(VERSION);

// Global options
program
  .option('--config <path>', 'Path to agentlint config file')
  .option('--format <fmt>', 'Output format: text|json|sarif', 'text')
  .option('--output <path>', 'Write output to file instead of stdout')
  .option('--no-color', 'Disable ANSI colors')
  .option('--quiet', 'Only print errors')
  .option('--verbose', 'Extra parsing/evidence details')
  .option('--fail-on <level>', 'Severity threshold for failure: none|low|medium|high', 'high')
  .option('--warn-on <level>', 'Severity threshold for warning: none|low|medium|high', 'medium')
  .option('--timeout <duration>', 'Timeout duration (e.g., 2s, 5s)', '10s');

// Scan command
program
  .command('scan [path]')
  .description('Scan a directory for agent configuration files')
  .option('--ci', 'CI mode: no prompts, stable output, enforce gating')
  .option('--include <glob>', 'Include extra files (repeatable)', collect, [])
  .option('--exclude <glob>', 'Exclude files/paths (repeatable)', collect, [])
  .option('--tool <tool>', 'Tool mode: claude|cursor|auto', 'auto')
  .option('--emit-ir', 'Include IR in JSON output')
  .option('--permissions-only', 'Output only recommended permission manifest')
  .action(async (scanPath: string | undefined, options) => {
    const globalOpts = program.opts();
    const targetPath = scanPath || process.cwd();

    // Load policy
    const policyResult = loadPolicy(globalOpts.config, targetPath);
    if (policyResult.errors.length > 0) {
      console.error('Configuration errors:');
      policyResult.errors.forEach(e => console.error(`  ${e}`));
      process.exit(3);
    }

    const policy = policyResult.config;

    // Apply CLI overrides
    if (globalOpts.failOn) {
      policy.policy.fail_on = globalOpts.failOn;
    }
    if (globalOpts.warnOn) {
      policy.policy.warn_on = globalOpts.warnOn;
    }
    if (options.ci) {
      policy.policy.ci_mode = true;
    }
    if (options.include.length > 0) {
      policy.scan.include.push(...options.include);
    }
    if (options.exclude.length > 0) {
      policy.scan.exclude.push(...options.exclude);
    }
    if (options.tool !== 'auto') {
      policy.scan.tool_mode = options.tool;
    }

    // Validate policy
    const validationErrors = validatePolicy(policy);
    if (validationErrors.length > 0) {
      console.error('Policy validation errors:');
      validationErrors.forEach(e => console.error(`  ${e}`));
      process.exit(3);
    }

    // Run scanner
    const scanner = new Scanner({
      root: path.resolve(targetPath),
      include: policy.scan.include,
      exclude: policy.scan.exclude,
      policy,
      ciMode: options.ci || false,
    });

    try {
      const result = await scanner.scan();

      // Handle permissions-only mode
      if (options.permissionsOnly) {
        const output = JSON.stringify(result.recommendedPermissions, null, 2);
        writeOutput(output, globalOpts.output);
        process.exit(result.exitCode);
      }

      // Generate report
      const reportData = scanner.createReportData(result);
      const reportOptions: ReportOptions = {
        format: globalOpts.format as ReportFormat,
        color: globalOpts.color !== false && !options.ci,
        includeRecommendations: policy.output.include_recommendations,
        includePermissionManifest: policy.output.include_permission_manifest,
        includeIR: options.emitIr || false,
        verbose: globalOpts.verbose || false,
      };

      const output = generateReport(reportData, reportOptions);

      if (!globalOpts.quiet) {
        writeOutput(output, globalOpts.output);
      }

      process.exit(result.exitCode);
    } catch (error) {
      console.error('Scan failed:', error instanceof Error ? error.message : String(error));
      process.exit(5);
    }
  });

// Diff command
program
  .command('diff <base> <target>')
  .description('Compare two versions and report behavioral changes')
  .option('--fail-on-change <type>', 'Change types that trigger failure (repeatable)', collect, [])
  .action(async (baseRef: string, targetRef: string, options) => {
    const globalOpts = program.opts();

    // Load policy
    const policyResult = loadPolicy(globalOpts.config);
    if (policyResult.errors.length > 0) {
      console.error('Configuration errors:');
      policyResult.errors.forEach(e => console.error(`  ${e}`));
      process.exit(3);
    }

    const policy = policyResult.config;

    // For now, we only support directory-based diff
    // Git ref support would require additional implementation
    if (!fs.existsSync(baseRef) || !fs.existsSync(targetRef)) {
      console.error('Error: Both base and target must be existing directories');
      console.error('Git ref support is planned for a future version.');
      process.exit(2);
    }

    try {
      // Scan both directories
      const baseScanner = new Scanner({
        root: path.resolve(baseRef),
        policy,
        ciMode: true,
      });
      const targetScanner = new Scanner({
        root: path.resolve(targetRef),
        policy,
        ciMode: true,
      });

      const baseResult = await baseScanner.scan();
      const targetResult = await targetScanner.scan();

      // Compare results
      const failOn = options.failOnChange.length > 0
        ? options.failOnChange
        : policy.diff.fail_on;

      const diffResult = compareScanResults(
        baseResult,
        targetResult,
        baseRef,
        targetRef,
        {
          policy,
          failOn,
          warnOn: policy.diff.warn_on,
        }
      );

      // Generate report
      const reportData = targetScanner.createReportData(targetResult);
      reportData.diff = diffResult;
      reportData.status = diffResult.summary.status;
      reportData.exitCode = diffResult.summary.exit_code;

      const reportOptions: ReportOptions = {
        format: globalOpts.format as ReportFormat,
        color: globalOpts.color !== false,
        includeRecommendations: true,
        includePermissionManifest: false,
        includeIR: false,
        verbose: globalOpts.verbose || false,
      };

      const output = generateDiffReport(reportData, reportOptions);

      if (!globalOpts.quiet) {
        writeOutput(output, globalOpts.output);
      }

      process.exit(diffResult.summary.exit_code);
    } catch (error) {
      console.error('Diff failed:', error instanceof Error ? error.message : String(error));
      process.exit(5);
    }
  });

// Rules command with subcommands
const rulesCommand = program
  .command('rules')
  .description('List and explain available rules');

rulesCommand
  .command('list')
  .description('List all available rules')
  .option('--group <group>', 'Filter by rule group')
  .action((options) => {
    const globalOpts = program.opts();
    const engine = new RuleEngine();
    let rules = engine.getAllRules();

    if (options.group) {
      rules = rules.filter(r => r.group === options.group);
    }

    if (globalOpts.format === 'json') {
      console.log(JSON.stringify(rules, null, 2));
    } else {
      console.log('Available rules:\n');
      for (const rule of rules) {
        const severity = rule.severity.toUpperCase().padEnd(6);
        console.log(`  ${severity} ${rule.id.padEnd(10)} ${rule.title}`);
      }
      console.log(`\nTotal: ${rules.length} rules`);
    }
  });

rulesCommand
  .command('explain <ruleId>')
  .description('Show detailed information about a rule')
  .action((ruleId: string) => {
    const globalOpts = program.opts();
    const engine = new RuleEngine();
    const rule = engine.getRuleDefinition(ruleId.toUpperCase());

    if (!rule) {
      console.error(`Rule not found: ${ruleId}`);
      process.exit(2);
    }

    if (globalOpts.format === 'json') {
      console.log(JSON.stringify(rule, null, 2));
    } else {
      console.log(`Rule: ${rule.id}`);
      console.log(`Title: ${rule.title}`);
      console.log(`Group: ${rule.group}`);
      console.log(`Severity: ${rule.severity.toUpperCase()}`);
      console.log(`\nDescription:`);
      console.log(`  ${rule.description}`);
      console.log(`\nRecommendation:`);
      console.log(`  ${rule.recommendation}`);
      console.log(`\nTags: ${rule.tags.join(', ')}`);
    }
  });

// Init command
program
  .command('init')
  .description('Create a default configuration file')
  .option('--ci <platform>', 'Include CI configuration (github)', '')
  .action((options) => {
    const configPath = 'agentlint.yaml';

    if (fs.existsSync(configPath)) {
      console.error(`Configuration file already exists: ${configPath}`);
      process.exit(2);
    }

    const config = generateDefaultConfig();
    fs.writeFileSync(configPath, config);
    console.log(`Created configuration file: ${configPath}`);

    if (options.ci === 'github') {
      const workflowDir = '.github/workflows';
      const workflowPath = path.join(workflowDir, 'agentlint.yaml');

      if (!fs.existsSync(workflowDir)) {
        fs.mkdirSync(workflowDir, { recursive: true });
      }

      const workflow = `name: AgentLint

on:
  pull_request:
    paths:
      - ".claude/**"
      - ".cursorrules"
      - "CLAUDE.md"
      - "AGENTS.md"

jobs:
  agentlint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install agentlint
        run: npm install -g agentlint

      - name: Scan
        run: agentlint scan --ci --format sarif --output agentlint.sarif

      - name: Upload SARIF
        uses: github/codeql-action/upload-sarif@v3
        with:
          sarif_file: agentlint.sarif
`;

      fs.writeFileSync(workflowPath, workflow);
      console.log(`Created GitHub Actions workflow: ${workflowPath}`);
    }
  });

// Version command (explicit)
program
  .command('version')
  .description('Show version information')
  .action(() => {
    console.log(`agentlint ${VERSION}`);
    console.log(`Node.js ${process.version}`);
    console.log(`Platform: ${process.platform} ${process.arch}`);
  });

// Helper functions
function collect(value: string, previous: string[]): string[] {
  return previous.concat([value]);
}

function writeOutput(content: string, outputPath?: string): void {
  if (outputPath) {
    fs.writeFileSync(outputPath, content);
  } else {
    console.log(content);
  }
}

// Parse and execute
program.parse();
