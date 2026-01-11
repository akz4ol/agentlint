/**
 * AgentLint - Static analysis and security scanner for AI agent configuration files
 *
 * @packageDocumentation
 */

// Export IR types (core data structures)
export * from './ir/types';

// Export parsers
export * from './parsers';

// Export rules
export * from './rules';

// Export reports (excluding types to avoid conflicts)
export { generateReport, generateDiffReport } from './reports';
export { TextReportGenerator, generateDiffTextReport } from './reports/text';
export { JsonReportGenerator, generateDiffJsonReport } from './reports/json';
export { SarifReportGenerator, generateDiffSarifReport } from './reports/sarif';
export type { ReportOptions, ReportData, ReportFormat } from './reports/types';

// Export policy (use PolicyConfig from policy, not ir/types which has different structure)
export { loadPolicy, validatePolicy, generateDefaultConfig } from './policy/loader';
export { DEFAULT_POLICY } from './policy/types';
export type { PolicyConfig as AgentLintPolicyConfig } from './policy/types';

// Export scanner
export { Scanner } from './scanner';
export type { ScanOptions, ScanResult } from './scanner';

// Export diff
export { compareScanResults } from './diff';
export type { DiffOptions } from './diff';
