# Launch Collateral

Ready-to-use announcements for launching AgentLint.

## One-Liner

> AgentLint: Supply-chain security for AI agent configurations. Scan Claude Code, Cursor, and CLAUDE.md files for risky patterns before agents execute.

## Twitter/X Thread

```
1/ Introducing AgentLint - the first security scanner for AI agent configs

AI coding agents can run shell commands, access networks, and modify files. But who's auditing their configuration files?

AgentLint does. In your CI. Before it's too late.

2/ What it catches:
- curl | bash patterns (supply chain risk)
- Hooks running without approval
- Secret references in configs
- Unscoped file access

20 rules across 8 categories, purpose-built for agent configs.

3/ Works with:
- Claude Code (.claude/, CLAUDE.md)
- Cursor (.cursorrules)
- AGENTS.md

Get started in 30 seconds:
npm install -g agentlint
agentlint scan

https://github.com/akz4ol/agentlint
```

## Hacker News

**Title:** AgentLint - Static security scanner for AI agent configurations

**Text:**
Hey HN,

I built AgentLint because I was worried about the security implications of AI coding agents. These tools can execute shell commands, access the network, and modify files - yet their configuration files are often shared without any security review.

AgentLint treats agent configs like code: it scans .claude/, .cursorrules, and CLAUDE.md files for risky patterns like:

- curl | bash (supply chain attacks)
- Hooks that auto-execute without approval
- References to secret environment variables
- Unscoped file write access

It outputs SARIF for GitHub Code Scanning integration, so findings appear as PR annotations.

Try it: `npx agentlint scan`

GitHub: https://github.com/akz4ol/agentlint

Would love feedback on the rule set and what other patterns you'd want detected.

## Reddit (r/programming, r/netsec)

**Title:** I built a security scanner for AI agent config files (Claude Code, Cursor, etc.)

**Post:**
AI coding agents are getting more powerful, but their configuration files are a blind spot for security.

I built AgentLint to scan these configs for risks:
- Dynamic shell execution (curl | bash)
- Hooks that run automatically
- Secret references
- Excessive file access

It works like ESLint but for agent-specific semantics. Outputs SARIF for GitHub integration.

`npm install -g agentlint && agentlint scan`

https://github.com/akz4ol/agentlint

Open to feedback on what rules would be useful!

## LinkedIn

Excited to share AgentLint - a security scanner for AI agent configurations.

As AI coding assistants become mainstream, their config files (skills, hooks, rules) represent a new attack surface that traditional security tools miss.

AgentLint scans Claude Code, Cursor, and CLAUDE.md files for:
- Supply chain risks (curl | bash patterns)
- Automated execution without approval
- Credential exposure
- Excessive permissions

20 security rules. SARIF output for GitHub. Fully offline.

Check it out: https://github.com/akz4ol/agentlint

#security #ai #devsecops #supplychain

## Dev.to / Blog Post Outline

**Title:** Securing the New Attack Surface: Auditing AI Agent Configurations

**Sections:**
1. The Rise of AI Coding Agents
2. Why Agent Configs Are a Security Risk
3. Introducing AgentLint
4. How It Works (with diagrams)
5. Real-World Examples
6. Getting Started
7. Future Roadmap

## Newsletter Blurb

**AgentLint** scans AI agent configuration files for security risks. It catches dangerous patterns like `curl | bash`, secret references, and auto-triggered hooks before agents execute. Works with Claude Code, Cursor, and CLAUDE.md. Open source, fully offline.

Try it: `npx agentlint scan`
GitHub: https://github.com/akz4ol/agentlint
