import * as path from 'node:path';
import type { CheckResult, Violation } from './types.js';

export type ReportFormat = 'text' | 'json' | 'sarif';

export function buildCheckJson(result: CheckResult, cwd: string): Record<string, unknown> {
  return {
    passed: result.passed,
    failOn: result.failOn,
    errorCount: result.errorCount,
    warningCount: result.warningCount,
    filesChecked: result.filesChecked,
    regionsChecked: result.regionsChecked,
    violations: result.violations.map(violation => serializeViolation(violation, cwd)),
  };
}

export function buildSarifReport(result: CheckResult, cwd: string): Record<string, unknown> {
  return {
    version: '2.1.0',
    $schema: 'https://json.schemastore.org/sarif-2.1.0.json',
    runs: [
      {
        tool: {
          driver: {
            name: 'snippetfence',
            rules: [
              {
                id: 'snippetfence/protected-region-modification',
                name: 'Protected region modification',
                shortDescription: {
                  text: 'Protected region modification',
                },
                fullDescription: {
                  text: 'Modifying fenced code without removing the protection markers is blocked by snippetfence.',
                },
              },
            ],
          },
        },
        results: result.violations.map(violation => ({
          ruleId: 'snippetfence/protected-region-modification',
          level: violation.region.severity === 'warn' ? 'warning' : 'error',
          message: {
            text: buildSarifMessage(violation, cwd),
          },
          locations: [
            {
                physicalLocation: {
                  artifactLocation: {
                  uri: toRelativePath(cwd, violation.region.filePath),
                  },
                region: {
                  startLine: violation.deletedFile ? violation.region.startLine : violation.modifiedLine,
                },
              },
            },
          ],
        })),
      },
    ],
  };
}

function serializeViolation(violation: Violation, cwd: string): Record<string, unknown> {
  const result: Record<string, unknown> = {
    file: toRelativePath(cwd, violation.region.filePath),
    region: violation.region.id,
    startLine: violation.region.startLine,
    endLine: violation.region.endLine,
    modifiedLine: violation.modifiedLine,
    modifiedLines: violation.modifiedLines,
    reason: violation.region.reason,
    severity: violation.region.severity,
    owners: violation.region.owners,
    tags: violation.region.tags,
    message: violation.region.message,
    diffHunk: violation.diffHunk,
  };
  if (violation.deletedFile) {
    result.deletedFile = true;
  }
  return result;
}

function buildSarifMessage(violation: Violation, cwd: string): string {
  const relPath = toRelativePath(cwd, violation.region.filePath);
  const parts = [`${relPath}:${violation.region.startLine}-${violation.region.endLine}`];
  if (violation.region.reason) {
    parts.push(`reason=${violation.region.reason}`);
  }
  if (violation.region.message) {
    parts.push(`message=${violation.region.message}`);
  }
  if (violation.region.owners?.length) {
    parts.push(`owners=${violation.region.owners.join(',')}`);
  }
  if (violation.region.tags?.length) {
    parts.push(`tags=${violation.region.tags.join(',')}`);
  }
  return parts.join(' ');
}

function toRelativePath(cwd: string, filePath: string): string {
  return path.relative(cwd, filePath).replace(/\\/g, '/');
}
