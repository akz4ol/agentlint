# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 0.1.x   | :white_check_mark: |

## Reporting a Vulnerability

We take security seriously. If you discover a security vulnerability in AgentLint, please report it responsibly.

### How to Report

1. **Do NOT** open a public issue
2. Email: blog.mot2gmob@gmail.com
3. Include:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Any suggested fixes (optional)

### What to Expect

- **Acknowledgment**: Within 48 hours
- **Initial Assessment**: Within 7 days
- **Resolution Timeline**: Depends on severity
  - Critical: 7 days
  - High: 14 days
  - Medium: 30 days
  - Low: 60 days

### Scope

In scope:
- AgentLint CLI tool
- Parser vulnerabilities
- Rule bypass issues
- Report generation flaws

Out of scope:
- Issues in dependencies (report to upstream)
- Social engineering
- Physical security

## Security Design

AgentLint is designed with security in mind:

- **No Code Execution**: Pure static analysis, never executes scanned content
- **No Network Access**: Completely offline operation
- **No File Modification**: Read-only scanning
- **No Secret Access**: Does not read or store credentials

## Acknowledgments

We appreciate responsible disclosure and will acknowledge reporters in our release notes (unless anonymity is requested).
