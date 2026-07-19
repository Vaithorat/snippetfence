import { validateConfig } from './config.js';
import { parseAndValidateRepo } from './parser.js';
import type { ValidateIssue, ValidateResult } from './types.js';

export function validateRepository(cwd: string): ValidateResult {
  const configResult = validateConfig(cwd);
  const repoResult = parseAndValidateRepo(cwd);
  const issues: ValidateIssue[] = [];

  for (const issue of configResult.issues) {
    issues.push({
      level: issue.level,
      source: 'config',
      code: issue.code,
      message: issue.message,
      filePath: issue.filePath ?? cwd,
    });
  }

  for (const warning of repoResult.warnings) {
    issues.push({
      level: 'error',
      source: 'fence',
      code: warning.type,
      message: warning.message,
      filePath: warning.filePath,
      line: warning.line,
    });
  }

  return {
    passed: issues.length === 0,
    issues,
    filesChecked: repoResult.filesChecked,
    regionsChecked: repoResult.regions.length,
  };
}
