# Launch Checklist

Pre-launch readiness checklist for AgentLint.

## Core Product

- [x] CLI works: `agentlint scan`, `agentlint diff`, `agentlint rules`
- [x] 20 security rules implemented
- [x] Claude Code parser (.claude/, CLAUDE.md)
- [x] Cursor parser (.cursorrules)
- [x] Text, JSON, SARIF output formats
- [x] Policy file support (agentlint.yaml)
- [x] Exit codes for CI integration

## Documentation

- [x] README.md with quick start
- [x] docs/cli.md - CLI reference
- [x] docs/faq.md - Frequently asked questions
- [x] docs/design.md - Architecture
- [x] docs/launch.md - Launch collateral

## Examples

- [x] examples/minimal - Clean config (PASS)
- [x] examples/realistic - Risky config (FAIL)

## Governance

- [x] LICENSE (Apache 2.0)
- [x] CODE_OF_CONDUCT.md
- [x] CONTRIBUTING.md
- [x] SECURITY.md
- [x] SUPPORT.md
- [x] MAINTAINERS.md

## Automation

- [x] .github/workflows/ci.yml
- [x] .github/workflows/release.yml
- [x] .github/dependabot.yml
- [x] .github/ISSUE_TEMPLATE/
- [x] .github/PULL_REQUEST_TEMPLATE.md

## Release

- [x] CHANGELOG.md
- [x] RELEASING.md
- [x] package.json complete (name, description, keywords, repo, etc.)

## Developer Experience

- [x] Makefile
- [x] .editorconfig
- [x] .eslintrc.json
- [x] .prettierrc
- [x] jest.config.js
- [x] Sample tests

## Pre-Launch

- [ ] npm publish (or dry-run)
- [ ] GitHub repo settings (description, topics, website)
- [ ] First release tag (v0.1.0)

## Launch Day

- [ ] Post to Hacker News
- [ ] Post to Twitter/X
- [ ] Post to Reddit (r/programming, r/netsec)
- [ ] Post to LinkedIn
- [ ] Submit to Product Hunt (optional)

---

## Readiness Score

**18/21 items complete = 86%**

Missing:
1. npm publish
2. GitHub settings
3. Release tag

Ready for launch after completing pre-launch items.
