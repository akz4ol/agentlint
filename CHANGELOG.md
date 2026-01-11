# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.2.0] - 2026-01-11

### Added

- **Auto-fix**: Automatically fix simple issues with `--fix` and `--dry-run` flags
  - OBS-002: Adds permission manifest comment
- **Baseline support**: Suppress known findings with baseline files
  - `--update-baseline`: Create/update baseline from current findings
  - `--ignore-baseline`: Report all findings regardless of baseline
  - `--prune-baseline`: Remove fixed findings from baseline
  - `--baseline <path>`: Custom baseline file path
- **Integrations**:
  - [agentlint-action](https://github.com/akz4ol/agentlint-action): Native GitHub Action
  - [agentlint-vscode](https://github.com/akz4ol/agentlint-vscode): VS Code extension
  - Pre-commit hook support

### Changed

- CLI now respects `.agentlint-baseline.json` automatically when present

## [0.1.0] - 2025-01-11

### Added

- Initial release of AgentLint
- **Multi-tool support**: Claude Code (.claude/), Cursor (.cursorrules), CLAUDE.md, AGENTS.md
- **20 security rules** across 8 categories:
  - Execution (EXEC): Dynamic shell execution, non-interactive context
  - Filesystem (FS): Unscoped writes, sensitive paths, cross-boundary
  - Network (NET): Undeclared access, remote scripts, broad access
  - Secrets (SEC): Environment secrets, file access, propagation
  - Hook (HOOK): Auto-triggered hooks, hidden activation
  - Instruction (INST): Override patterns, self-modification
  - Scope (SCOPE): Capability expansion, write scope widening
  - Observability (OBS): Missing declarations, no manifest
- **CLI commands**: scan, diff, rules list, rules explain, init, version
- **Output formats**: text, JSON, SARIF (GitHub code scanning)
- **Policy file support**: agentlint.yaml configuration
- **Diff analysis**: Behavioral change detection between versions
- **Permission manifest**: Recommended permissions generation

[Unreleased]: https://github.com/akz4ol/agentlint/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/akz4ol/agentlint/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/akz4ol/agentlint/releases/tag/v0.1.0
