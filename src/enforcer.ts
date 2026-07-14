import { execSync } from 'node:child_process';
import * as path from 'node:path';
import { parseFile } from './parser.js';
import type { CheckResult, ProtectedRegion, Violation } from './types.js';

export function getStagedFiles(cwd: string): string[] {
  try {
    const output = execSync('git diff --cached --name-only --diff-filter=ACMR', {
      cwd,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
    if (!output) return [];
    return output.split('\n').filter(Boolean);
  } catch {
    return [];
  }
}

export function getStagedDiff(filePath: string, cwd: string): string {
  try {
    return execSync(`git diff --cached --unified=0 -- "${filePath}"`, {
      cwd,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
  } catch {
    return '';
  }
}

export function parseDiffChangedLines(diff: string): number[] {
  const lines: number[] = [];
  const hunkRegex = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/gm;
  let match: RegExpExecArray | null;

  while ((match = hunkRegex.exec(diff)) !== null) {
    const start = parseInt(match[1], 10);
    const count = match[2] ? parseInt(match[2], 10) : 1;
    for (let i = 0; i < count; i++) {
      lines.push(start + i);
    }
  }

  return lines;
}

export function checkViolations(
  regions: ProtectedRegion[],
  changedLines: number[],
  filePath: string
): Violation[] {
  const fileRegions = regions.filter(r => r.filePath === path.resolve(filePath));
  const violations: Violation[] = [];

  for (const region of fileRegions) {
    for (const line of changedLines) {
      if (line >= region.startLine && line <= region.endLine) {
        violations.push({
          region,
          modifiedLine: line,
          diffHunk: '',
        });
        break;
      }
    }
  }

  return violations;
}

export function checkStagedChanges(cwd: string): CheckResult {
  const files = getStagedFiles(cwd);
  const allViolations: Violation[] = [];
  let regionsChecked = 0;

  for (const file of files) {
    const absPath = path.resolve(cwd, file);
    let regions: ProtectedRegion[];
    try {
      regions = parseFile(absPath);
    } catch {
      continue;
    }

    regionsChecked += regions.length;
    if (regions.length === 0) continue;

    const diff = getStagedDiff(file, cwd);
    if (!diff) continue;

    const changedLines = parseDiffChangedLines(diff);
    const violations = checkViolations(regions, changedLines, file);
    allViolations.push(...violations);
  }

  return {
    passed: allViolations.length === 0,
    violations: allViolations,
    filesChecked: files.length,
    regionsChecked,
  };
}
