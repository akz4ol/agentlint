# CLI Reference

Complete command-line reference for AgentLint.

## Global Options

These options are available on all commands:

| Option | Description | Default |
|--------|-------------|---------|
| `--config <path>` | Path to config file | Auto-discover |
| `--format <fmt>` | Output format: `text`, `json`, `sarif` | `text` |
| `--output <path>` | Write to file instead of stdout | stdout |
| `--no-color` | Disable colored output | colors enabled |
| `--quiet` | Only print errors | false |
| `--verbose` | Extra details | false |
| `--fail-on <level>` | Fail threshold: `none`, `low`, `medium`, `high` | `high` |
| `--warn-on <level>` | Warn threshold | `medium` |

## Commands

### `agentlint scan [path]`

Scan a directory for agent configuration files.

```bash
# Scan current directory
agentlint scan

# Scan specific path
agentlint scan ./my-project

# CI mode (stable output, no prompts)
agentlint scan --ci

# JSON output
agentlint scan --format json

# SARIF for GitHub code scanning
agentlint scan --format sarif --output results.sarif

# Only output recommended permissions
agentlint scan --permissions-only
```

#### Scan Options

| Option | Description |
|--------|-------------|
| `--ci` | CI mode: no prompts, stable output |
| `--include <glob>` | Include additional files (repeatable) |
| `--exclude <glob>` | Exclude files (repeatable) |
| `--tool <tool>` | Tool mode: `auto`, `claude`, `cursor` |
| `--emit-ir` | Include IR in JSON output |
| `--permissions-only` | Output only permission manifest |

### `agentlint diff <base> <target>`

Compare two versions and report behavioral changes.

```bash
# Compare directories
agentlint diff ./v1 ./v2

# With JSON output
agentlint diff ./before ./after --format json

# Custom fail conditions
agentlint diff ./old ./new --fail-on-change capability_expansion
```

#### Diff Options

| Option | Description |
|--------|-------------|
| `--fail-on-change <type>` | Change types that trigger failure (repeatable) |

#### Change Types

- `capability_expansion` - New capabilities added
- `shell_dynamic_introduced` - Dynamic shell execution added
- `network_new_outbound` - Outbound network access added
- `context_change_to_hook` - Interactive → hook context
- `write_scope_widening_to_all` - Write scope expanded to all files
- `sensitive_path_newly_touched` - New sensitive paths accessed

### `agentlint rules list`

List all available security rules.

```bash
# List all rules
agentlint rules list

# Filter by group
agentlint rules list --group execution

# JSON output
agentlint rules list --format json
```

### `agentlint rules explain <rule-id>`

Show detailed information about a rule.

```bash
agentlint rules explain EXEC-001
```

Output:
```
Rule: EXEC-001
Title: Dynamic Shell Execution
Group: execution
Severity: HIGH

Description:
  Detects shell execution where the command is dynamically constructed
  or fetched. This includes patterns like curl|bash, wget|sh, and eval
  with variables.

Recommendation:
  Replace with fixed commands or disable shell access. Use pinned,
  verified installers instead of fetching scripts from the network.

Tags: rce, supply-chain, dynamic-execution
```

### `agentlint init`

Create a default configuration file.

```bash
# Create agentlint.yaml
agentlint init

# Include GitHub Actions workflow
agentlint init --ci github
```

### `agentlint version`

Show version information.

```bash
agentlint version
```

Output:
```
agentlint 0.1.0
Node.js v20.0.0
Platform: darwin arm64
```

## Exit Codes

| Code | Meaning | When |
|------|---------|------|
| 0 | Pass | No findings at/above fail threshold |
| 1 | Fail | Findings at/above fail threshold |
| 2 | CLI Error | Invalid arguments or usage |
| 3 | Config Error | Invalid configuration file |
| 4 | Parse Error | Failed to parse agent configs |
| 5 | Internal Error | Unexpected error |

## Output Formats

### Text (default)

Human-readable console output with colors.

```
AgentLint scan: .

Parsed: 3 documents (claude=3)
Context: hooks detected

Findings:
  HIGH  EXEC-001 Dynamic Shell Execution
    .claude/hooks/post_edit.sh:5-5
    Evidence: "curl https://example.com/install.sh | bash"
    Recommendation: Replace with fixed commands...

Status: FAIL (1 high)
```

### JSON

Machine-readable report for automation.

```bash
agentlint scan --format json | jq '.summary'
```

### SARIF

GitHub Code Scanning format.

```bash
agentlint scan --format sarif --output results.sarif
```

Upload to GitHub:
```yaml
- uses: github/codeql-action/upload-sarif@v3
  with:
    sarif_file: results.sarif
```

## Configuration File

AgentLint looks for configuration in this order:

1. `--config <path>` (explicit)
2. `agentlint.yaml`
3. `.agentlint.yaml`
4. `.agentlint/agentlint.yaml`

See the main README for configuration options.

## Environment Variables

AgentLint respects standard environment variables:

| Variable | Effect |
|----------|--------|
| `NO_COLOR` | Disable colored output |
| `FORCE_COLOR` | Force colored output |

## Examples

### Basic Scanning

```bash
# Scan and fail on high severity
agentlint scan

# Scan and fail on medium or higher
agentlint scan --fail-on medium

# Scan but don't fail on anything
agentlint scan --fail-on none
```

### CI Pipeline

```bash
# GitHub Actions with SARIF
agentlint scan --ci --format sarif --output agentlint.sarif

# GitLab CI with JSON
agentlint scan --ci --format json --output agentlint.json

# Exit code for scripting
agentlint scan --ci && echo "Passed" || echo "Failed"
```

### Filtering

```bash
# Only scan Claude files
agentlint scan --tool claude

# Include additional patterns
agentlint scan --include "**/*.agent.md"

# Exclude test fixtures
agentlint scan --exclude "test/fixtures/**"
```

### Automation

```bash
# Get findings as JSON for processing
agentlint scan --format json | jq '.findings[] | .rule_id'

# Count findings by severity
agentlint scan --format json | jq '.summary.counts_by_severity'

# Extract recommended permissions
agentlint scan --permissions-only > permissions.json
```
