<p align="center">
  <h1 align="center">AgentLint</h1>
  <p align="center">
    <strong>Supply-chain security for AI agent configurations</strong>
  </p>
  <p align="center">
    <a href="https://github.com/akz4ol/agentlint/actions/workflows/ci.yml"><img src="https://github.com/akz4ol/agentlint/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
    <a href="https://www.npmjs.com/package/agentlint"><img src="https://img.shields.io/npm/v/agentlint.svg" alt="npm"></a>
    <a href="https://github.com/akz4ol/agentlint/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-Apache%202.0-blue.svg" alt="License"></a>
  </p>
</p>

---

**AgentLint** helps developers and security teams **audit AI agent configurations** before they execute—catching `curl | bash`, secret leaks, and privilege escalation in Claude Code, Cursor, and CLAUDE.md files.

## Why AgentLint?

AI coding agents are powerful—but their configuration files are a new attack surface:

- **Skills can run shell commands** → supply-chain risk
- **Hooks execute automatically** → no user approval
- **Configs reference secrets** → credential exposure
- **Anyone can share skills** → no vetting process

AgentLint treats agent configs like code: **scan, diff, and gate them in CI.**

## Quick Start

```bash
# Install
npm install -g agentlint

# Scan your project
agentlint scan
```

**Expected output (clean project):**
```
AgentLint scan: .

Parsed: 2 documents (claude=2)

No findings detected.

Status: PASS
```

**Expected output (risky config):**
```
AgentLint scan: .

Parsed: 4 documents (claude=3, cursor=1)
Context: hooks detected

Findings:
  HIGH  EXEC-001 Dynamic Shell Execution
    .claude/hooks/post_edit.sh:5
    Evidence: "curl https://example.com/install.sh | bash"

  HIGH  SEC-001 Environment Secret Reference
    CLAUDE.md:14
    Reference to secret: $STRIPE_SECRET_KEY

Status: FAIL (2 high)
```

## How It Works

```
┌─────────────────┐     ┌──────────────┐     ┌─────────────┐
│  .claude/       │     │              │     │             │
│  .cursorrules   │────▶│  AgentLint   │────▶│  Findings   │
│  CLAUDE.md      │     │              │     │             │
└─────────────────┘     └──────────────┘     └─────────────┘
        │                      │                    │
        ▼                      ▼                    ▼
   Parse to IR          Apply 20 Rules      Text/JSON/SARIF
```

1. **Parse** agent configs into a normalized internal representation
2. **Analyze** with 20 security rules across 8 categories
3. **Report** findings with evidence and remediation guidance
4. **Gate** in CI with configurable severity thresholds

## Examples

Try AgentLint on our example configs:

```bash
# Clean config (passes)
agentlint scan examples/minimal

# Risky config (fails with findings)
agentlint scan examples/realistic
```

See [examples/](examples/) for full details.

## What It Detects

| Category | Rules | What It Catches |
|----------|-------|-----------------|
| **Execution** | EXEC-001, 002, 003 | `curl \| bash`, eval, hooks running commands |
| **Filesystem** | FS-001, 002, 003 | Unscoped writes, `.git/` access, sensitive paths |
| **Network** | NET-001, 002, 003 | Undeclared network, remote script fetches |
| **Secrets** | SEC-001, 002, 003 | `$GITHUB_TOKEN`, `.env` access, secret propagation |
| **Hooks** | HOOK-001, 002 | Auto-triggered side effects, hidden hooks |
| **Instructions** | INST-001, 002 | "Ignore previous instructions", self-modification |
| **Scope** | SCOPE-001, 002 | Capability expansion, write scope widening |
| **Observability** | OBS-001, 002 | Missing declarations, no permission manifest |

Run `agentlint rules list` to see all rules, or `agentlint rules explain EXEC-001` for details.

## CI/CD Integration

### GitHub Actions

```yaml
name: AgentLint
on:
  pull_request:
    paths: [".claude/**", ".cursorrules", "CLAUDE.md", "AGENTS.md"]

jobs:
  scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm install -g agentlint
      - run: agentlint scan --ci --format sarif --output agentlint.sarif
      - uses: github/codeql-action/upload-sarif@v3
        with:
          sarif_file: agentlint.sarif
```

Findings appear as code annotations in PRs via GitHub Code Scanning.

### Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Pass |
| 1 | Findings at/above threshold |
| 2 | CLI usage error |
| 3 | Config error |
| 4 | Parse error |
| 5 | Internal error |

## Configuration

Create `agentlint.yaml` to customize behavior:

```yaml
version: 1

policy:
  fail_on: high      # Fail CI on high severity
  warn_on: medium    # Warn on medium severity

rules:
  disable: [OBS-002] # Disable specific rules

capabilities:
  fail_on_new_dynamic_shell: true
  fail_on_sensitive_path_write: true
```

Generate a starter config:

```bash
agentlint init
agentlint init --ci github  # Include GitHub Actions workflow
```

## Diff Mode

Detect behavioral changes between versions:

```bash
agentlint diff ./before ./after
```

```
AgentLint diff: ./before → ./after

Behavioral changes:
  HIGH  capability_expansion
    shell_exec: false → true

  HIGH  network_new_outbound
    network.outbound: false → true

Status: FAIL (capability expansion detected)
```

## Comparison with Alternatives

| | AgentLint | Manual Review | No Scanning |
|---|---|---|---|
| Detects `curl \| bash` | Automatic | Maybe | No |
| CI integration | Native SARIF | Manual | N/A |
| Diff detection | Semantic | Text diff | None |
| Time to review | Seconds | Minutes–Hours | N/A |

AgentLint is purpose-built for AI agent configs. General linters miss agent-specific risks.

## Integrations

| Tool | Link |
|------|------|
| **VS Code** | [agentlint-vscode](https://github.com/akz4ol/agentlint-vscode) |
| **GitHub Action** | [agentlint-action](https://github.com/akz4ol/agentlint-action) |
| **Pre-commit** | [docs/pre-commit.md](docs/pre-commit.md) |

## Roadmap

- [x] Claude Code support (`.claude/`, `CLAUDE.md`)
- [x] Cursor support (`.cursorrules`)
- [x] 20 security rules
- [x] SARIF output for GitHub
- [x] Diff mode
- [x] VS Code extension
- [x] GitHub Action (native)
- [x] Pre-commit hook
- [ ] Auto-fix for common issues
- [ ] Policy-as-code engine
- [ ] Signed skill packs
- [ ] Agent config registry

## Documentation

- [CLI Reference](docs/cli.md)
- [FAQ](docs/faq.md)
- [Architecture](docs/design.md)
- [Pre-commit Hook](docs/pre-commit.md)
- [Contributing](CONTRIBUTING.md)
- [Security Policy](SECURITY.md)

## Contributing

We welcome contributions! See [CONTRIBUTING.md](CONTRIBUTING.md) for:

- Development setup
- Adding new rules
- Coding standards
- PR process

## License

Apache 2.0 — see [LICENSE](LICENSE)

---

<p align="center">
  <sub>Built to secure the AI agent ecosystem</sub>
</p>
