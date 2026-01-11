# Minimal Example

A simple, safe agent configuration that passes all AgentLint checks.

## Contents

- `CLAUDE.md` - Basic project guidelines
- `.claude/skills/format.md` - Simple formatting skill

## Run AgentLint

```bash
# From repo root
agentlint scan examples/minimal

# Or from this directory
cd examples/minimal
agentlint scan
```

## Expected Output

```
AgentLint scan: examples/minimal

Parsed: 2 documents (claude=2)

No findings detected.

Status: PASS
```

This example demonstrates a clean configuration with no security issues.
