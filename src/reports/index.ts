export * from './types';
export * from './text';
export * from './json';
export * from './sarif';

import { ReportData, ReportOptions } from './types';
import { TextReportGenerator, generateDiffTextReport } from './text';
import { JsonReportGenerator, generateDiffJsonReport } from './json';
import { SarifReportGenerator, generateDiffSarifReport } from './sarif';

/**
 * Generate a report in the specified format
 */
export function generateReport(data: ReportData, options: ReportOptions): string {
  switch (options.format) {
    case 'json':
      return new JsonReportGenerator(options).generate(data);
    case 'sarif':
      return new SarifReportGenerator(options).generate(data);
    case 'text':
    default:
      return new TextReportGenerator(options).generate(data);
  }
}

/**
 * Generate a diff report in the specified format
 */
export function generateDiffReport(data: ReportData, options: ReportOptions): string {
  switch (options.format) {
    case 'json':
      return generateDiffJsonReport(data);
    case 'sarif':
      return generateDiffSarifReport(data);
    case 'text':
    default:
      return generateDiffTextReport(data, options);
  }
}
