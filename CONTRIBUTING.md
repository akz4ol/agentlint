# Contributing to AgentLint

First off, thank you for considering contributing to AgentLint! It's people like you that make AgentLint such a great tool for securing AI agent configurations.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [How Can I Contribute?](#how-can-i-contribute)
- [Development Setup](#development-setup)
- [Project Structure](#project-structure)
- [Adding New Rules](#adding-new-rules)
- [Coding Standards](#coding-standards)
- [Commit Messages](#commit-messages)
- [Pull Request Process](#pull-request-process)

## Code of Conduct

This project and everyone participating in it is governed by our [Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code.

## Getting Started

- Make sure you have a [GitHub account](https://github.com/signup)
- Fork the repository on GitHub
- Clone your fork locally
- Set up the development environment (see below)

## How Can I Contribute?

### Reporting Bugs

Before creating bug reports, please check existing issues to avoid duplicates. When you create a bug report, include as many details as possible using our [bug report template](.github/ISSUE_TEMPLATE/bug_report.yml).

### Suggesting Features

Feature suggestions are welcome! Please use our [feature request template](.github/ISSUE_TEMPLATE/feature_request.yml) and provide as much context as possible.

### Proposing New Rules

New security rules are always welcome! Please use our [new rule template](.github/ISSUE_TEMPLATE/new_rule.yml) and include:
- Clear description of what the rule detects
- Why it's a security concern
- Examples of triggering and non-triggering code
- Suggested severity level

### Contributing Code

1. Look for issues labeled `good first issue` or `help wanted`
2. Comment on the issue to let others know you're working on it
3. Fork and create a branch from `main`
4. Make your changes
5. Submit a pull request

## Development Setup

### Prerequisites

- Node.js 18.x or later
- npm 9.x or later
- Git

### Setup Steps

```bash
# Clone your fork
git clone https://github.com/YOUR_USERNAME/agentlint.git
cd agentlint

# Install dependencies
npm install

# Build the project
npm run build

# Run tests
npm test

# Run the CLI locally
node dist/cli/index.js scan
```

### Available Scripts

| Script | Description |
|--------|-------------|
| `npm run build` | Compile TypeScript to JavaScript |
| `npm test` | Run unit tests |
| `npm run lint` | Run ESLint |
| `npm run lint:fix` | Fix ESLint issues automatically |
| `npm run clean` | Remove build artifacts |

## Project Structure

```
agentlint/
├── src/
│   ├── cli/           # CLI entry point and commands
│   ├── diff/          # Diff comparison functionality
│   ├── ir/            # Internal representation types
│   ├── parsers/       # File parsers (Claude, Cursor)
│   ├── policy/        # Policy configuration
│   ├── reports/       # Output formatters (text, JSON, SARIF)
│   ├── rules/         # Security rule implementations
│   ├── utils/         # Utility functions
│   ├── scanner.ts     # Core scanning orchestration
│   └── index.ts       # Library exports
├── tests/             # Test files
├── examples/          # Example configurations
└── docs/              # Documentation
```

## Adding New Rules

### 1. Choose the Right Group

Rules are organized into groups:
- `execution` (EXEC) - Shell execution risks
- `filesystem` (FS) - File access risks
- `network` (NET) - Network access risks
- `secrets` (SEC) - Credential/secret risks
- `hook` (HOOK) - Automation risks
- `instruction` (INST) - Instruction integrity
- `scope` (SCOPE) - Capability expansion
- `observability` (OBS) - Audit/visibility

### 2. Create the Rule

Create your rule in `src/rules/{group}.ts`:

```typescript
export class YourNewRule extends BaseRule {
  constructor() {
    super({
      id: 'GROUP-NNN',           // e.g., EXEC-004
      group: 'execution',
      severity: 'high',          // high | medium | low
      title: 'Your Rule Title',
      description: 'What this rule detects and why it matters.',
      recommendation: 'How to fix the issue.',
      tags: ['tag1', 'tag2'],
    });
  }

  evaluate(context: RuleContext): Finding[] {
    const findings: Finding[] = [];
    const { document, minConfidence } = context;

    // Your detection logic here
    for (const action of document.actions) {
      if (/* your condition */) {
        const finding = this.createFinding(
          document,
          action.anchors,
          'Your finding message',
          action.evidence,
          0.9  // confidence
        );
        findings.push(finding);
      }
    }

    return findings;
  }
}
```

### 3. Register the Rule

Add your rule to the exports in `src/rules/{group}.ts`:

```typescript
export const groupRules = [
  // existing rules...
  new YourNewRule(),
];
```

### 4. Add Tests

Create tests in `tests/rules/{group}.test.ts`:

```typescript
describe('YourNewRule', () => {
  it('should detect risky pattern', () => {
    // Test triggering case
  });

  it('should not flag safe pattern', () => {
    // Test non-triggering case
  });
});
```

### 5. Update Documentation

- Add the rule to README.md rule table
- Update CHANGELOG.md

## Coding Standards

### TypeScript Guidelines

- Use TypeScript strict mode
- Prefer `const` over `let`
- Use explicit types for function parameters and returns
- Avoid `any` - use `unknown` if type is truly unknown
- Use meaningful variable names

### Code Style

- 2 spaces for indentation
- Single quotes for strings
- No semicolons (handled by Prettier)
- Max line length: 100 characters

### File Organization

- One class/interface per file when possible
- Export everything through index.ts files
- Keep files under 400 lines

## Commit Messages

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

### Types

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation only
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Build, CI, or tooling changes
- `rule`: New security rule

### Examples

```
feat(cli): add --severity-threshold flag

fix(parser): handle empty CLAUDE.md files

rule(exec): add EXEC-004 command injection detection

docs: update README with new examples
```

## Pull Request Process

1. **Update your fork**
   ```bash
   git checkout main
   git pull upstream main
   ```

2. **Create a feature branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

3. **Make your changes**
   - Write code
   - Add tests
   - Update documentation

4. **Ensure quality**
   ```bash
   npm run lint
   npm test
   npm run build
   ```

5. **Commit your changes**
   ```bash
   git add .
   git commit -m "feat(scope): description"
   ```

6. **Push to your fork**
   ```bash
   git push origin feature/your-feature-name
   ```

7. **Create a Pull Request**
   - Use our PR template
   - Link related issues
   - Request review from maintainers

8. **Address feedback**
   - Make requested changes
   - Push updates to your branch
   - Re-request review when ready

## Recognition

Contributors are recognized in:
- The project's README.md
- Release notes
- The GitHub contributors page

Thank you for contributing to AgentLint!
