# Architecture & Design

This document describes AgentLint's internal architecture for contributors and those interested in how it works.

## Project Detection Summary

AgentLint is a:
- **CLI tool** written in TypeScript
- **Static analyzer** for AI agent configuration files
- **Multi-format reporter** (text, JSON, SARIF)

### Runtime
- Node.js 18+
- No native dependencies
- Fully offline (no network access)

### How to Build
```bash
npm install
npm run build
```

### How to Test
```bash
npm test
```

### How to Run
```bash
node dist/cli/index.js scan
# or
npm link && agentlint scan
```

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                           CLI Layer                              │
│  (src/cli/index.ts - Commander.js)                              │
└─────────────────────┬───────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                         Scanner                                  │
│  (src/scanner.ts - Orchestration)                               │
└───────┬─────────────────────┬─────────────────────┬─────────────┘
        │                     │                     │
        ▼                     ▼                     ▼
┌───────────────┐     ┌───────────────┐     ┌───────────────┐
│    Parsers    │     │  Rule Engine  │     │   Reporters   │
│ (src/parsers/)│     │ (src/rules/)  │     │ (src/reports/)│
└───────┬───────┘     └───────┬───────┘     └───────┬───────┘
        │                     │                     │
        ▼                     ▼                     ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Internal Representation (IR)                  │
│  (src/ir/types.ts)                                              │
└─────────────────────────────────────────────────────────────────┘
```

## Core Components

### 1. Internal Representation (IR)

The IR is the foundation—a normalized data structure that represents agent configurations regardless of source format.

**Key Types** (`src/ir/types.ts`):

```typescript
// Top-level document
interface AgentDocument {
  path: string;
  tool_family: 'claude' | 'cursor' | 'generic';
  doc_type: 'skill' | 'agent' | 'hook' | 'rules' | 'memory';
  actions: Action[];
  capabilities: Capability[];
  context_profile: ContextProfile;
}

// Detected behaviors
interface Action {
  type: 'shell_exec' | 'network_call' | 'file_write' | ...;
  context: 'interactive' | 'hook' | 'ci';
  evidence: Evidence[];
  anchors: { start_line: number; end_line: number };
}

// Aggregated permissions
interface CapabilitySummary {
  shell_exec: { enabled: boolean; dynamic_detected: boolean };
  network: { outbound: boolean; inbound: boolean };
  filesystem: { write: string[]; touches_sensitive_paths: string[] };
  secrets: { env_vars_referenced: string[] };
}
```

### 2. Parsers

Parsers convert vendor-specific files into the IR.

**Location**: `src/parsers/`

```
parsers/
├── base.ts      # Abstract base class with shared utilities
├── claude.ts    # Claude Code parser (.claude/, CLAUDE.md)
├── cursor.ts    # Cursor parser (.cursorrules)
├── factory.ts   # Parser selection based on file path
└── index.ts     # Exports
```

**Parser Flow**:
1. Receive file path and content
2. Determine document type and format
3. Extract instruction blocks and actions
4. Derive capabilities from actions
5. Return `AgentDocument` IR

**Adding a New Parser**:
1. Extend `BaseParser`
2. Implement `canHandle(path)` and `parse(path, content)`
3. Register in `ParserFactory`

### 3. Rule Engine

The rule engine evaluates IR documents against security rules.

**Location**: `src/rules/`

```
rules/
├── base.ts          # BaseRule abstract class
├── engine.ts        # Rule orchestration
├── types.ts         # Rule interfaces
├── execution.ts     # EXEC-001, EXEC-002, EXEC-003
├── filesystem.ts    # FS-001, FS-002, FS-003
├── network.ts       # NET-001, NET-002, NET-003
├── secrets.ts       # SEC-001, SEC-002, SEC-003
├── hook.ts          # HOOK-001, HOOK-002
├── instruction.ts   # INST-001, INST-002
├── scope.ts         # SCOPE-001, SCOPE-002
├── observability.ts # OBS-001, OBS-002
└── index.ts         # Exports
```

**Rule Structure**:
```typescript
class MyRule extends BaseRule {
  constructor() {
    super({
      id: 'GROUP-NNN',
      group: 'execution',
      severity: 'high',
      title: 'Rule Title',
      description: '...',
      recommendation: '...',
      tags: ['tag1', 'tag2'],
    });
  }

  evaluate(context: RuleContext): Finding[] {
    // Analyze context.document
    // Return findings
  }
}
```

**Rule Categories**:

| Group | Prefix | Focus |
|-------|--------|-------|
| Execution | EXEC | Shell commands, dynamic execution |
| Filesystem | FS | File access, writes, sensitive paths |
| Network | NET | Outbound/inbound, remote fetches |
| Secrets | SEC | Credentials, environment variables |
| Hook | HOOK | Auto-triggered behaviors |
| Instruction | INST | Prompt injection, self-modification |
| Scope | SCOPE | Capability expansion (for diff) |
| Observability | OBS | Audit, declarations |

### 4. Reports

Reporters convert findings into output formats.

**Location**: `src/reports/`

```
reports/
├── types.ts    # Report interfaces
├── text.ts     # Human-readable console output
├── json.ts     # Machine-readable JSON
├── sarif.ts    # GitHub Code Scanning format
└── index.ts    # Format selection
```

**Output Formats**:

| Format | Use Case | Features |
|--------|----------|----------|
| Text | Local development | Colors, concise |
| JSON | Automation | Full report, machine-readable |
| SARIF | GitHub integration | Code scanning annotations |

### 5. Scanner

The scanner orchestrates the entire flow.

**Location**: `src/scanner.ts`

**Flow**:
1. Find matching files
2. Parse each file → IR documents
3. Compute capability summary
4. Run rule engine → findings
5. Generate recommended permissions
6. Determine status/exit code
7. Create report data

### 6. Policy

Policy configuration controls behavior.

**Location**: `src/policy/`

```
policy/
├── types.ts   # PolicyConfig interface
├── loader.ts  # YAML loading, validation
└── index.ts   # Exports
```

**Configuration Precedence**:
1. CLI flags (highest)
2. `agentlint.yaml`
3. Default values (lowest)

### 7. Diff

Diff compares two scan results for behavioral changes.

**Location**: `src/diff/`

**Detects**:
- Capability expansion
- New high-severity findings
- Context changes (interactive → hook)
- Scope widening

## Data Flow

```
File System
    │
    ▼
┌───────────────────┐
│  Glob Matching    │ ← Include/exclude patterns
└─────────┬─────────┘
          │
          ▼
┌───────────────────┐
│  Parser Factory   │ ← Select parser by file type
└─────────┬─────────┘
          │
          ▼
┌───────────────────┐
│  Parse to IR      │ ← Extract actions, capabilities
└─────────┬─────────┘
          │
          ▼
┌───────────────────┐
│  Capability       │ ← Aggregate from all documents
│  Summary          │
└─────────┬─────────┘
          │
          ▼
┌───────────────────┐
│  Rule Engine      │ ← Evaluate 20 rules
└─────────┬─────────┘
          │
          ▼
┌───────────────────┐
│  Findings         │ ← Sort, dedupe, fingerprint
└─────────┬─────────┘
          │
          ▼
┌───────────────────┐
│  Report           │ ← Format for output
└─────────┬─────────┘
          │
          ▼
     Output
```

## Key Design Decisions

### Tool-Agnostic IR

The IR is vendor-neutral so:
- Rules work across Claude/Cursor/future tools
- Adding new parsers doesn't require rule changes
- Diffing works semantically, not textually

### Static Analysis Only

AgentLint never:
- Executes code
- Makes network requests
- Modifies files
- Accesses secrets

This ensures safety and predictability.

### Confidence-Based Filtering

Actions and findings have confidence scores (0–1):
- Parser assigns confidence based on detection method
- Rules can require minimum confidence
- Reduces false positives

### Deterministic Output

For CI stability:
- Findings sorted by severity → path → line → rule
- Hashes are stable (SHA256)
- Same input → same output

## Directory Structure

```
agentlint/
├── src/
│   ├── cli/           # CLI entry point
│   ├── diff/          # Diff comparison
│   ├── ir/            # Internal representation types
│   ├── parsers/       # File parsers
│   ├── policy/        # Configuration
│   ├── reports/       # Output formatters
│   ├── rules/         # Security rules
│   ├── utils/         # Utilities (hashing, etc.)
│   ├── scanner.ts     # Main orchestration
│   └── index.ts       # Library exports
├── tests/             # Test files
├── examples/          # Example configurations
│   ├── minimal/       # Clean config
│   └── realistic/     # Risky config
├── docs/              # Documentation
└── dist/              # Compiled output
```

## Future Architecture

Planned extensions:

1. **Policy-as-Code Engine**: Declarative policy rules
2. **Pack Signing**: Cryptographic verification of configs
3. **Registry**: Central repository of verified configs
4. **Plugins**: Custom parsers and rules via extensions
