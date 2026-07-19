import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { parseContent } from './parser.js';
import type { CheckResult, ProtectedRegion, Violation } from './types.js';

interface ParsedDiffHunk {
  diffHunk: string;
  addedLines: number[];
  removedLines: number[];
}

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

export function getUntrackedFiles(cwd: string): string[] {
  try {
    const output = execFileSync('git', ['ls-files', '--others', '--exclude-standard'], {
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

export function getHeadFileContent(filePath: string, cwd: string): string | null {
  try {
    return execFileSync('git', ['show', `HEAD:${filePath.replace(/\\/g, '/')}`], {
      cwd,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
  } catch {
    return null;
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
  return parseDiffHunks(diff).flatMap(hunk => hunk.addedLines);
}

function parseDiffHunks(diff: string): ParsedDiffHunk[] {
  const hunks: ParsedDiffHunk[] = [];
  const diffChunks = diff.split(/(?=^@@ )/m);

  for (const chunk of diffChunks) {
    if (!chunk.startsWith('@@')) continue;

    const headerMatch = chunk.match(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/);
    if (!headerMatch) continue;

    const oldStart = parseInt(headerMatch[1], 10);
    const newStart = parseInt(headerMatch[3], 10);
    const body = chunk.slice(chunk.indexOf('\n') + 1);

    let oldLineNum = oldStart;
    let newLineNum = newStart;
    const addedLines: number[] = [];
    const removedLines: number[] = [];

    for (const bodyLine of body.split('\n')) {
      if (bodyLine.startsWith('\\')) continue;
      if (bodyLine.startsWith('+')) {
        addedLines.push(newLineNum);
        newLineNum++;
        continue;
      }
      if (bodyLine.startsWith('-')) {
        removedLines.push(oldLineNum);
        oldLineNum++;
        continue;
      }

      oldLineNum++;
      newLineNum++;
    }

    hunks.push({ diffHunk: chunk.trimEnd(), addedLines, removedLines });
  }

  return hunks;
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

export function checkAllChanges(cwd: string): CheckResult {
  const staged = checkStagedChanges(cwd);
  const working = checkWorkingTreeChanges(cwd);
  const untracked = checkUntrackedChanges(cwd);
  const violations = dedupeViolations([...staged.violations, ...working.violations, ...untracked.violations]);
  const filesChecked = new Set([...getStagedFiles(cwd), ...getWorkingTreeFiles(cwd), ...getUntrackedFiles(cwd)]).size;

  return {
    passed: violations.length === 0,
    violations,
    filesChecked,
    regionsChecked: staged.regionsChecked + working.regionsChecked + untracked.regionsChecked,
  };
}

function checkChanges(cwd: string, mode: 'staged' | 'working'): CheckResult {
  const files = mode === 'staged' ? getStagedFiles(cwd) : getWorkingTreeFiles(cwd);
  const allViolations: Violation[] = [];
  let regionsChecked = 0;

  for (const file of files) {
    const absPath = path.resolve(cwd, file);
    let currentRegions: ProtectedRegion[];
    let previousRegions: ProtectedRegion[];

    try {
      if (mode === 'staged') {
        const stagedContent = getStagedFileContent(file, cwd);
        if (stagedContent === null) continue;
        currentRegions = parseContent(stagedContent, absPath);
        previousRegions = parsePreviousRegions(getHeadFileContent(file, cwd), absPath);
      } else {
        currentRegions = parseContent(fs.readFileSync(absPath, 'utf-8'), absPath);
        previousRegions = parsePreviousRegions(getStagedFileContent(file, cwd), absPath);
      }
    } catch {
      continue;
    }

    regionsChecked += currentRegions.length;
    if (currentRegions.length === 0 && previousRegions.length === 0) continue;

    const diff = mode === 'staged' ? getStagedDiff(file, cwd) : getWorkingTreeDiff(file, cwd);
    if (!diff) continue;

    const violations = checkDiffViolations(previousRegions, currentRegions, absPath, diff);
    allViolations.push(...violations);
  }

  return {
    passed: allViolations.length === 0,
    violations: dedupeViolations(allViolations),
    filesChecked: files.length,
    regionsChecked,
  };
}

function checkUntrackedChanges(cwd: string): CheckResult {
  const files = getUntrackedFiles(cwd);
  const allViolations: Violation[] = [];
  let regionsChecked = 0;

  for (const file of files) {
    const absPath = path.resolve(cwd, file);

    try {
      const content = fs.readFileSync(absPath, 'utf-8');
      const regions = parseContent(content, absPath);
      regionsChecked += regions.length;
      if (regions.length === 0) continue;

      const changedLines = content.split('\n').map((_, index) => index + 1);
      allViolations.push(...checkViolations(regions, changedLines, absPath));
    } catch {
      continue;
    }
  }

  return {
    passed: allViolations.length === 0,
    violations: dedupeViolations(allViolations),
    filesChecked: files.length,
    regionsChecked,
  };
}

function parsePreviousRegions(content: string | null, absPath: string): ProtectedRegion[] {
  if (content === null) return [];
  return parseContent(content, absPath);
}

function checkDiffViolations(
  previousRegions: ProtectedRegion[],
  currentRegions: ProtectedRegion[],
  filePath: string,
  diff: string
): Violation[] {
  const filePreviousRegions = previousRegions.filter(r => r.filePath === path.resolve(filePath));
  const fileCurrentRegions = currentRegions.filter(r => r.filePath === path.resolve(filePath));
  const violations: Violation[] = [];

  for (const hunk of parseDiffHunks(diff)) {
    for (const region of fileCurrentRegions) {
      for (const line of hunk.addedLines) {
        if (line >= region.startLine && line <= region.endLine) {
          violations.push({ region, modifiedLine: line, diffHunk: hunk.diffHunk });
        }
      }
    }

    for (const region of filePreviousRegions) {
      for (const line of hunk.removedLines) {
        if (line >= region.startLine && line <= region.endLine) {
          violations.push({ region, modifiedLine: line, diffHunk: hunk.diffHunk });
        }
      }
    }
  }

  return violations;
}

function dedupeViolations(violations: Violation[]): Violation[] {
  const seen = new Set<string>();
  return violations.filter(violation => {
    const key = [
      violation.region.id,
      violation.region.filePath,
      violation.modifiedLine,
      violation.diffHunk,
    ].join(':');
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}
