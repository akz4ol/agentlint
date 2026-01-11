# Frequently Asked Questions

## General

### What is AgentLint?

AgentLint is a static analysis and security scanner for AI agent configuration files. It scans files like `.claude/skills/*.md`, `.cursorrules`, and `CLAUDE.md` to detect security risks before agents execute.

### Why do I need this?

AI coding agents are increasingly powerful—they can run shell commands, access the network, and modify files. Their configuration files define what they can do, but there's no standard way to audit these configurations for security risks.

AgentLint fills this gap by:
- Detecting risky patterns like `curl | bash`
- Identifying secret references and credential exposure
- Flagging hooks that run without user approval
- Enabling CI/CD gating for agent configs

### Is this specific to Claude?

No. AgentLint supports multiple AI coding tools:
- **Claude Code**: `.claude/` directory, `CLAUDE.md`
- **Cursor**: `.cursorrules`
- **Generic**: `AGENTS.md`

The internal representation is tool-agnostic, so adding support for new tools is straightforward.

### How is this different from ESLint/other linters?

General-purpose linters don't understand AI agent semantics:
- They can't detect that `curl | bash` in a skill file is risky
- They don't know what a "hook" is or why auto-triggered hooks are dangerous
- They can't track capability expansion between versions

AgentLint is purpose-built for agent configurations.

## Usage

### How do I install AgentLint?

```bash
npm install -g agentlint
```

Or use npx without installing:

```bash
npx agentlint scan
```

### What files does AgentLint scan?

By default:
- `.claude/skills/**/*.md`
- `.claude/agents/**/*.md`
- `.claude/hooks/**`
- `CLAUDE.md`
- `AGENTS.md`
- `.cursorrules`

You can customize this with `--include` and `--exclude` flags or in `agentlint.yaml`.

### How do I integrate with CI/CD?

Add a workflow that runs AgentLint on PRs that modify agent configs:

```yaml
name: AgentLint
on:
  pull_request:
    paths: [".claude/**", ".cursorrules", "CLAUDE.md"]

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

### How do I suppress false positives?

You can:

1. **Disable specific rules** in `agentlint.yaml`:
   ```yaml
   rules:
     disable: [OBS-002]
   ```

2. **Adjust severity thresholds**:
   ```yaml
   policy:
     fail_on: high  # Only fail on high severity
   ```

3. **Exclude specific files**:
   ```yaml
   scan:
     exclude: ["test/fixtures/**"]
   ```

### Can I run AgentLint offline?

Yes. AgentLint is completely offline—it doesn't make any network requests. All analysis is done locally.

## Rules

### Why did EXEC-001 trigger?

EXEC-001 (Dynamic Shell Execution) triggers when it detects patterns like:
- `curl https://... | bash`
- `wget ... | sh`
- `eval $VARIABLE`

These patterns allow remote code execution and are major supply-chain risks.

**Fix**: Use pinned, verified scripts instead of fetching and executing in one command.

### Why did SEC-001 trigger?

SEC-001 (Environment Secret Reference) triggers when agent configs reference known secret environment variables like:
- `$GITHUB_TOKEN`
- `$AWS_SECRET_ACCESS_KEY`
- `$STRIPE_SECRET_KEY`

**Fix**: Agents generally shouldn't need direct access to secrets. If they do, ensure it's explicit and audited.

### Why did HOOK-001 trigger?

HOOK-001 (Auto-Triggered Hook with Side Effects) triggers when hooks run automatically and perform:
- Shell commands
- Network requests
- File writes

These actions happen without user approval.

**Fix**: Move side effects to interactive skills, or carefully audit hook behavior.

### How do I add a new rule?

See [CONTRIBUTING.md](../CONTRIBUTING.md#adding-new-rules) for instructions on implementing new rules.

## Troubleshooting

### AgentLint found no files to scan

Make sure your project has supported files:
- `.claude/skills/*.md`
- `.cursorrules`
- `CLAUDE.md`

Check the `--include` patterns in your configuration.

### Parse errors on my files

AgentLint uses best-effort parsing. If a file can't be fully parsed:
- The scan continues with partial results
- Warnings are included in the output

If you're seeing unexpected parse errors, please [open an issue](https://github.com/akz4ol/agentlint/issues).

### CI is failing but I want to proceed

For temporary bypasses:
```bash
agentlint scan --fail-on none  # Never fail
agentlint scan --fail-on high  # Only fail on high severity
```

For permanent policy changes, update `agentlint.yaml`.

## Security

### Does AgentLint execute any code?

No. AgentLint is pure static analysis. It:
- Reads files
- Parses content
- Applies pattern matching
- Generates reports

It never executes shell commands, makes network requests, or runs any code from the scanned files.

### Does AgentLint send data anywhere?

No. AgentLint is completely offline and doesn't include any telemetry. All analysis is local.

### How do I report a security issue?

See [SECURITY.md](../SECURITY.md) for our security policy and how to report vulnerabilities.

## Contributing

### How can I contribute?

We welcome contributions! See [CONTRIBUTING.md](../CONTRIBUTING.md) for:
- Development setup
- Adding new rules
- Coding standards
- PR process

### Can I add support for a new tool?

Yes! The parser architecture is modular. See [docs/design.md](design.md) for architecture details, then:

1. Create a new parser in `src/parsers/`
2. Register it in `src/parsers/factory.ts`
3. Add tests
4. Open a PR

### Where can I ask questions?

- [GitHub Discussions](https://github.com/akz4ol/agentlint/discussions) for questions
- [GitHub Issues](https://github.com/akz4ol/agentlint/issues) for bugs and features
- See [SUPPORT.md](../SUPPORT.md) for all support channels
