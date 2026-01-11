# AgentLint

**Static analysis and security scanner for AI agent configuration files**

> Installing agent skills should be as safe, auditable, and predictable as installing software dependencies.

AgentLint is a static analysis and policy enforcement tool for AI agent configuration files. It enables developers and organizations to understand *what an agent configuration can do*, detect risks early, and enforce safety rules before execution.

## Features

- **Multi-tool Support**: Scans Claude Code (`.claude/`), Cursor (`.cursorrules`), and `CLAUDE.md`/`AGENTS.md` files
- **Security Detection**: Identifies shell execution, network access, credential usage, and sensitive file access
- **Policy Enforcement**: CI/CD gating with configurable severity thresholds
- **Multiple Output Formats**: Text, JSON, and SARIF (GitHub code scanning)
- **Diff Analysis**: Detect behavioral changes between versions
- **Permission Manifests**: Generate recommended permission declarations

## Installation

```bash
npm install -g agentlint
```

## Quick Start

```bash
# Scan current directory
agentlint scan

# Scan with CI mode (for pipelines)
agentlint scan --ci

# Generate SARIF for GitHub code scanning
agentlint scan --format sarif --output results.sarif

# Compare two versions
agentlint diff ./old-config ./new-config

# List available rules
agentlint rules list

# Explain a specific rule
agentlint rules explain EXEC-001
```

## Configuration

Create an `agentlint.yaml` file:

```yaml
version: 1

policy:
  fail_on: high
  warn_on: medium

rules:
  disable:
    - OBS-002

capabilities:
  fail_on_new_dynamic_shell: true
  fail_on_sensitive_path_write: true
```

Initialize with defaults:

```bash
agentlint init
agentlint init --ci github  # Include GitHub Actions workflow
```

## Rule Categories

| Category | Rules | Description |
|----------|-------|-------------|
| Execution (EXEC) | EXEC-001, EXEC-002, EXEC-003 | Shell execution risks |
| Filesystem (FS) | FS-001, FS-002, FS-003 | File access and write risks |
| Network (NET) | NET-001, NET-002, NET-003 | Network access risks |
| Secrets (SEC) | SEC-001, SEC-002, SEC-003 | Credential and secret access |
| Hook (HOOK) | HOOK-001, HOOK-002 | Automated hook risks |
| Instruction (INST) | INST-001, INST-002 | Instruction override patterns |
| Scope (SCOPE) | SCOPE-001, SCOPE-002 | Capability expansion |
| Observability (OBS) | OBS-001, OBS-002 | Audit and visibility |

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Pass - no findings at or above fail threshold |
| 1 | Fail - findings at/above fail threshold |
| 2 | CLI usage error |
| 3 | Config error |
| 4 | Parse error |
| 5 | Internal error |

## GitHub Actions

```yaml
name: AgentLint

on:
  pull_request:
    paths:
      - ".claude/**"
      - ".cursorrules"
      - "CLAUDE.md"

jobs:
  agentlint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Install agentlint
        run: npm install -g agentlint
      - name: Scan
        run: agentlint scan --ci --format sarif --output agentlint.sarif
      - name: Upload SARIF
        uses: github/codeql-action/upload-sarif@v3
        with:
          sarif_file: agentlint.sarif
```

## Supported Files

### Claude Code
- `.claude/skills/*.md` - Skill definitions
- `.claude/agents/*.md` - Agent definitions
- `.claude/hooks/*` - Hook scripts
- `CLAUDE.md` - Project memory

### Cursor
- `.cursorrules` - Cursor rules

### Generic
- `AGENTS.md` - Agent memory (best-effort)

## Contributing

Contributions are welcome! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

Apache 2.0 - See [LICENSE](LICENSE) for details.
