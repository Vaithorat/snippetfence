import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { parseContent } from './parser.js';
import type { CheckResult, ProtectedRegion, Violation } from './types.js';

export function getStagedFiles(cwd: string): string[] {
  try {
    const output = execFileSync('git', ['diff', '--cached', '--name-only', '--diff-filter=ACMR'], {
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

export function getWorkingTreeFiles(cwd: string): string[] {
  try {
    const output = execFileSync('git', ['diff', '--name-only', '--diff-filter=ACMR'], {
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
    return execFileSync('git', ['diff', '--cached', '--unified=0', '--', filePath], {
      cwd,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
  } catch {
    return '';
  }
}

export function getWorkingTreeDiff(filePath: string, cwd: string): string {
  try {
    return execFileSync('git', ['diff', '--unified=0', '--', filePath], {
      cwd,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
  } catch {
    return '';
  }
}

export function getStagedFileContent(filePath: string, cwd: string): string | null {
  try {
    return execFileSync('git', ['show', `:${filePath}`], {
      cwd,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
  } catch {
    return null;
  }
}

export function parseDiffChangedLines(diff: string): number[] {
  const lines: number[] = [];
  const hunks = diff.split(/(?=^@@ )/m);

  for (const hunk of hunks) {
    if (!hunk.startsWith('@@')) continue;
    const headerMatch = hunk.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/);
    if (!headerMatch) continue;

    const start = parseInt(headerMatch[1], 10);
    const body = hunk.slice(hunk.indexOf('\n') + 1);
    let lineNum = start;

    for (const bodyLine of body.split('\n')) {
      if (bodyLine.startsWith('\\')) continue;
      if (bodyLine.startsWith('+')) {
        lines.push(lineNum);
      }
      if (!bodyLine.startsWith('-')) {
        lineNum++;
      }
    }
  }

  return lines;
}

export function extractDiffHunk(diff: string, lineNumber: number): string {
  const hunks = diff.split(/(?=^@@ )/m);
  for (const hunk of hunks) {
    if (!hunk.startsWith('@@')) continue;
    const headerMatch = hunk.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/);
    if (!headerMatch) continue;
    const start = parseInt(headerMatch[1], 10);
    const count = headerMatch[2] ? parseInt(headerMatch[2], 10) : 1;
    if (lineNumber >= start && lineNumber < start + count) {
      return hunk.trimEnd();
    }
  }
  return '';
}

export function checkViolations(
  regions: ProtectedRegion[],
  changedLines: number[],
  filePath: string,
  diff?: string
): Violation[] {
  const fileRegions = regions.filter(r => r.filePath === path.resolve(filePath));
  const violations: Violation[] = [];

  for (const region of fileRegions) {
    for (const line of changedLines) {
      if (line >= region.startLine && line <= region.endLine) {
        violations.push({
          region,
          modifiedLine: line,
          diffHunk: diff ? extractDiffHunk(diff, line) : '',
        });
      }
    }
  }

  return violations;
}

export function checkStagedChanges(cwd: string): CheckResult {
  return checkChanges(cwd, 'staged');
}

export function checkWorkingTreeChanges(cwd: string): CheckResult {
  return checkChanges(cwd, 'working');
}

function checkChanges(cwd: string, mode: 'staged' | 'working'): CheckResult {
  const files = mode === 'staged' ? getStagedFiles(cwd) : getWorkingTreeFiles(cwd);
  const allViolations: Violation[] = [];
  let regionsChecked = 0;

  for (const file of files) {
    const absPath = path.resolve(cwd, file);
    let regions: ProtectedRegion[];

    try {
      if (mode === 'staged') {
        const stagedContent = getStagedFileContent(file, cwd);
        if (stagedContent === null) continue;
        regions = parseContent(stagedContent, absPath);
      } else {
        regions = parseContent(fs.readFileSync(absPath, 'utf-8'), absPath);
      }
    } catch {
      continue;
    }

    regionsChecked += regions.length;
    if (regions.length === 0) continue;

    const diff = mode === 'staged' ? getStagedDiff(file, cwd) : getWorkingTreeDiff(file, cwd);
    if (!diff) continue;

    const changedLines = parseDiffChangedLines(diff);
    const violations = checkViolations(regions, changedLines, absPath, diff);
    allViolations.push(...violations);
  }

  return {
    passed: allViolations.length === 0,
    violations: allViolations,
    filesChecked: files.length,
    regionsChecked,
  };
}
