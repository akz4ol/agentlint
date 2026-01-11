# Pre-commit Hook

AgentLint integrates with [pre-commit](https://pre-commit.com/) to scan agent configurations before each commit.

## Setup

1. Install pre-commit:
   ```bash
   pip install pre-commit
   ```

2. Add to your `.pre-commit-config.yaml`:
   ```yaml
   repos:
     - repo: https://github.com/akz4ol/agentlint
       rev: v0.1.0
       hooks:
         - id: agentlint
   ```

3. Install the hook:
   ```bash
   pre-commit install
   ```

## Usage

The hook runs automatically on commits that modify agent config files:
- `.claude/**`
- `.cursorrules`
- `CLAUDE.md`
- `AGENTS.md`

### Manual Run

```bash
# Run on all files
pre-commit run agentlint --all-files

# Run on staged files only
pre-commit run agentlint
```

## Configuration

Create `agentlint.yaml` in your repo to customize behavior:

```yaml
version: 1

policy:
  fail_on: high
  warn_on: medium

rules:
  disable: []
```

## Skipping the Hook

For emergencies only:

```bash
git commit --no-verify -m "message"
```

## Troubleshooting

### Hook not running?

Ensure you've installed the hook:
```bash
pre-commit install
```

### Need npx/Node.js?

The hook requires Node.js 18+. Install via:
```bash
# macOS
brew install node

# Ubuntu
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
```
