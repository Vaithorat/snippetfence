import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { loadConfig, matchesAnyPattern, resolvePolicy, toRepoRelativePath } from './config.js';
import { parseContent } from './parser.js';
import type { CheckResult, EffectivePolicy, PolicySeverity, ProtectedRegion, ResolvedConfig, Violation } from './types.js';

interface ParsedDiffHunk {
  diffHunk: string;
  addedLines: number[];
  removedLines: number[];
}

export interface CheckOptions {
  failOn?: PolicySeverity;
}

export function getStagedFiles(cwd: string): string[] {
  return getGitFileList(cwd, ['diff', '-M', '--cached', '--name-only', '--diff-filter=ACMR']);
}

function getStagedDeletedFiles(cwd: string): string[] {
  return getGitFileList(cwd, ['diff', '-M', '--cached', '--name-only', '--diff-filter=D']);
}

export function getWorkingTreeFiles(cwd: string): string[] {
  return getGitFileList(cwd, ['diff', '-M', '--name-only', '--diff-filter=ACMR']);
}

function getWorkingTreeDeletedFiles(cwd: string): string[] {
  return getGitFileList(cwd, ['diff', '-M', '--name-only', '--diff-filter=D']);
}

export function getUntrackedFiles(cwd: string): string[] {
  return getGitFileList(cwd, ['ls-files', '--others', '--exclude-standard']);
}

export function getChangedFilesBetweenRefs(cwd: string, base: string, head: string): string[] {
  return getGitFileList(cwd, ['diff', '-M', '--name-only', '--diff-filter=ACMR', base, head]);
}

function getDeletedFilesBetweenRefs(cwd: string, base: string, head: string): string[] {
  return getGitFileList(cwd, ['diff', '-M', '--name-only', '--diff-filter=D', base, head]);
}

interface RenameStatus {
  oldPath: string;
  newPath: string;
}

function getRenamedFiles(cwd: string): RenameStatus[] {
  return getRenamedFileList(cwd, ['diff', '-M', '--cached', '--name-status', '--diff-filter=R']);
}

function getRenamedFilesBetweenRefs(cwd: string, base: string, head: string): RenameStatus[] {
  return getRenamedFileList(cwd, ['diff', '-M', '--name-status', '--diff-filter=R', base, head]);
}

function getRenamedFileList(cwd: string, args: string[]): RenameStatus[] {
  try {
    const output = execFileSync('git', args, {
      cwd,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
    if (!output) return [];
    return output.split('\n').filter(Boolean).map(line => {
      const parts = line.split('\t');
      if (parts.length >= 3) {
        return { oldPath: parts[1], newPath: parts[2] };
      }
      return null;
    }).filter((r): r is RenameStatus => r !== null);
  } catch {
    return [];
  }
}

export function getHeadFileContent(filePath: string, cwd: string): string | null {
  return getRefFileContent('HEAD', filePath, cwd);
}

export function getRefFileContent(ref: string, filePath: string, cwd: string): string | null {
  try {
    return execFileSync('git', ['show', `${ref}:${filePath.replace(/\\/g, '/')}`], {
      cwd,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
  } catch {
    return null;
  }
}

export function getStagedDiff(filePath: string, cwd: string): string {
  return getGitDiff(cwd, ['diff', '-M', '--cached', '--unified=0', '--', filePath]);
}

export function getWorkingTreeDiff(filePath: string, cwd: string): string {
  return getGitDiff(cwd, ['diff', '-M', '--unified=0', '--', filePath]);
}

export function getDiffBetweenRefs(filePath: string, cwd: string, base: string, head: string): string {
  return getGitDiff(cwd, ['diff', '-M', '--unified=0', base, head, '--', filePath]);
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
  for (const hunk of diff.split(/(?=^@@ )/m)) {
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
  const fileRegions = regions.filter(region => region.filePath === path.resolve(filePath));
  const violations: Violation[] = [];

  for (const region of fileRegions) {
    const linesInRegion = changedLines.filter(line => line >= region.startLine && line <= region.endLine);
    if (linesInRegion.length > 0) {
      violations.push({
        region,
        modifiedLine: linesInRegion[0],
        modifiedLines: linesInRegion,
        diffHunk: diff ? extractDiffHunk(diff, linesInRegion[0]) : '',
      });
    }
  }

  return violations;
}

export function checkStagedChanges(cwd: string, options: CheckOptions = {}): CheckResult {
  return finalizeResult(checkChanges(cwd, 'staged'), options.failOn ?? 'error');
}

export function checkWorkingTreeChanges(cwd: string, options: CheckOptions = {}): CheckResult {
  return finalizeResult(checkChanges(cwd, 'working'), options.failOn ?? 'error');
}

export function checkAllChanges(cwd: string, options: CheckOptions = {}): CheckResult {
  const failOn = options.failOn ?? 'error';
  const config = loadConfig(cwd);
  const staged = checkChanges(cwd, 'staged');
  const working = checkChanges(cwd, 'working');
  const untracked = checkUntrackedChanges(cwd);
  const renames = getRenamedFiles(cwd);
  const renameViolations = checkRenameViolations(renames, config, cwd);
  const violations = dedupeViolations([...staged.violations, ...working.violations, ...untracked.violations, ...renameViolations]);
  const filesChecked = new Set([...getStagedFiles(cwd), ...getWorkingTreeFiles(cwd), ...getUntrackedFiles(cwd)]).size;

  return finalizeResult({
    passed: violations.length === 0,
    violations,
    filesChecked,
    regionsChecked: staged.regionsChecked + working.regionsChecked + untracked.regionsChecked,
    failOn,
    errorCount: 0,
    warningCount: 0,
  }, failOn);
}

export function checkRefChanges(cwd: string, base: string, head: string, options: CheckOptions = {}): CheckResult {
  const failOn = options.failOn ?? 'error';

  if (!refExists(base, cwd)) {
    return {
      passed: false,
      violations: [],
      filesChecked: 0,
      regionsChecked: 0,
      failOn,
      errorCount: 1,
      warningCount: 0,
    };
  }

  const files = getChangedFilesBetweenRefs(cwd, base, head);
  const deletedFiles = getDeletedFilesBetweenRefs(cwd, base, head);
  const renames = getRenamedFilesBetweenRefs(cwd, base, head);
  const config = loadConfig(cwd);
  const allViolations: Violation[] = [];
  let regionsChecked = 0;
  const renamedTo = new Set(renames.map(r => r.newPath));

  for (const file of files) {
    if (renamedTo.has(file)) continue; // ponytail: rename targets handled by checkRenameViolations; path-filtered diff shows false full-add
    const absPath = path.resolve(cwd, file);
    if (!isFileInScope(config, cwd, absPath)) continue;
    const policy = resolvePolicy(config, cwd, absPath);
    const previousRegions = parsePreviousRegions(getRefFileContent(base, file, cwd), absPath, policy);
    const currentRegions = parsePreviousRegions(getRefFileContent(head, file, cwd), absPath, policy);

    regionsChecked += currentRegions.length;
    if (previousRegions.length === 0 && currentRegions.length === 0) continue;

    const diff = getDiffBetweenRefs(file, cwd, base, head);
    if (!diff) continue;

    allViolations.push(...checkDiffViolations(previousRegions, currentRegions, absPath, diff));
  }

  const getRef = (file: string) => parsePreviousRegions(getRefFileContent(base, file, cwd), path.resolve(cwd, file), { severity: 'error' });
  allViolations.push(...checkDeletedFileViolations(deletedFiles, config, cwd, getRef));
  allViolations.push(...checkRenameViolations(renames, config, cwd, base, head));

  return finalizeResult({
    passed: allViolations.length === 0,
    violations: dedupeViolations(allViolations),
    filesChecked: files.length + deletedFiles.length,
    regionsChecked,
    failOn,
    errorCount: 0,
    warningCount: 0,
  }, failOn);
}

function checkDeletedFileViolations(
  deletedFiles: string[],
  config: ResolvedConfig,
  cwd: string,
  getRefContent: (file: string) => ProtectedRegion[]
): Violation[] {
  const violations: Violation[] = [];
  for (const file of deletedFiles) {
    const absPath = path.resolve(cwd, file);
    if (!isFileInScope(config, cwd, absPath)) continue;
    const regions = getRefContent(file);
    for (const region of regions) {
      violations.push({
        region,
        modifiedLine: 0,
        modifiedLines: [],
        diffHunk: `diff --git a/${file} b/${file}\ndeleted file mode 100644`,
        deletedFile: true,
      });
    }
  }
  return violations;
}

function isFileInScope(config: ResolvedConfig, rootDir: string, filePath: string): boolean {
  const relPath = toRepoRelativePath(rootDir, filePath);
  if (matchesAnyPattern(relPath, config.exclude)) return false;
  if (matchesAnyPattern(relPath, config.include)) return true;
  return config.include.length === 0;
}

function checkRenameViolations(renames: RenameStatus[], config: ResolvedConfig, cwd: string, baseRef = 'HEAD', headRef = 'HEAD'): Violation[] {
  const violations: Violation[] = [];

  for (const { oldPath, newPath } of renames) {
    const oldAbs = path.resolve(cwd, oldPath);
    const newAbs = path.resolve(cwd, newPath);
    if (!isFileInScope(config, cwd, oldAbs) && !isFileInScope(config, cwd, newAbs)) continue;

    const oldRegions = parsePreviousRegions(getRefFileContent(baseRef, oldPath, cwd), oldAbs, { severity: 'error' });
    const newRegions = parsePreviousRegions(getRefFileContent(headRef, newPath, cwd), newAbs, { severity: 'error' });

    if (oldRegions.length > 0 && newRegions.length === 0) {
      for (const region of oldRegions) {
        violations.push({
          region,
          modifiedLine: 0,
          modifiedLines: [],
          diffHunk: `rename from ${oldPath}\nrename to ${newPath}`,
        });
      }
    }
  }

  return violations;
}

function checkChanges(cwd: string, mode: 'staged' | 'working'): CheckResult {
  const files = mode === 'staged' ? getStagedFiles(cwd) : getWorkingTreeFiles(cwd);
  const deletedFiles = mode === 'staged' ? getStagedDeletedFiles(cwd) : getWorkingTreeDeletedFiles(cwd);
  const config = loadConfig(cwd);
  const allViolations: Violation[] = [];
  let regionsChecked = 0;
  const renamedTo = new Set(mode === 'staged' ? getRenamedFiles(cwd).map(r => r.newPath) : []);

  for (const file of files) {
    if (renamedTo.has(file)) continue; // ponytail: rename targets handled by checkRenameViolations
    const absPath = path.resolve(cwd, file);
    if (!isFileInScope(config, cwd, absPath)) continue;
    const policy = resolvePolicy(config, cwd, absPath);
    let currentRegions: ProtectedRegion[];
    let previousRegions: ProtectedRegion[];

    try {
      if (mode === 'staged') {
        const stagedContent = getStagedFileContent(file, cwd);
        if (stagedContent === null) continue;
        currentRegions = parseContent(stagedContent, absPath, 0, policy);
        previousRegions = parsePreviousRegions(getHeadFileContent(file, cwd), absPath, policy);
      } else {
        currentRegions = parseContent(fs.readFileSync(absPath, 'utf-8'), absPath, 0, policy);
        previousRegions = parsePreviousRegions(getStagedFileContent(file, cwd), absPath, policy);
      }
    } catch {
      continue;
    }

    regionsChecked += currentRegions.length;
    if (currentRegions.length === 0 && previousRegions.length === 0) continue;

    const diff = mode === 'staged' ? getStagedDiff(file, cwd) : getWorkingTreeDiff(file, cwd);
    if (!diff) continue;

    allViolations.push(...checkDiffViolations(previousRegions, currentRegions, absPath, diff));
  }

  const getRef = mode === 'staged'
    ? (file: string) => parsePreviousRegions(getHeadFileContent(file, cwd), path.resolve(cwd, file), { severity: 'error' })
    : (file: string) => parsePreviousRegions(getStagedFileContent(file, cwd), path.resolve(cwd, file), { severity: 'error' });
  allViolations.push(...checkDeletedFileViolations(deletedFiles, config, cwd, getRef));

  return {
    passed: allViolations.length === 0,
    violations: dedupeViolations(allViolations),
    filesChecked: files.length + deletedFiles.length,
    regionsChecked,
    failOn: 'error',
    errorCount: 0,
    warningCount: 0,
  };
}

function checkUntrackedChanges(cwd: string): CheckResult {
  const files = getUntrackedFiles(cwd);
  const config = loadConfig(cwd);
  const allViolations: Violation[] = [];
  let regionsChecked = 0;

  for (const file of files) {
    const absPath = path.resolve(cwd, file);
    if (!isFileInScope(config, cwd, absPath)) continue;

    try {
      const content = fs.readFileSync(absPath, 'utf-8');
      const policy = resolvePolicy(config, cwd, absPath);
      const regions = parseContent(content, absPath, 0, policy);
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
    failOn: 'error',
    errorCount: 0,
    warningCount: 0,
  };
}

function parsePreviousRegions(content: string | null, absPath: string, policy: EffectivePolicy): ProtectedRegion[] {
  if (content === null) return [];
  return parseContent(content, absPath, 0, policy);
}

function checkDiffViolations(
  previousRegions: ProtectedRegion[],
  currentRegions: ProtectedRegion[],
  filePath: string,
  diff: string
): Violation[] {
  const filePreviousRegions = previousRegions.filter(region => region.filePath === path.resolve(filePath));
  const fileCurrentRegions = currentRegions.filter(region => region.filePath === path.resolve(filePath));
  const violations: Violation[] = [];

  for (const hunk of parseDiffHunks(diff)) {
    const addedByRegion = new Map<string, number[]>();
    const removedByRegion = new Map<string, number[]>();

    for (const line of hunk.addedLines) {
      for (const region of fileCurrentRegions) {
        if (line >= region.startLine && line <= region.endLine) {
          const key = `${region.id}:${region.filePath}`;
          const arr = addedByRegion.get(key) ?? [];
          arr.push(line);
          addedByRegion.set(key, arr);
        }
      }
    }

    for (const line of hunk.removedLines) {
      for (const region of filePreviousRegions) {
        if (line >= region.startLine && line <= region.endLine) {
          const key = `${region.id}:${region.filePath}`;
          const arr = removedByRegion.get(key) ?? [];
          arr.push(line);
          removedByRegion.set(key, arr);
        }
      }
    }

    for (const [key, lines] of addedByRegion) {
      const region = fileCurrentRegions.find(r => `${r.id}:${r.filePath}` === key)!;
      violations.push({ region, modifiedLine: lines[0], modifiedLines: lines, diffHunk: hunk.diffHunk });
    }

    for (const [key, lines] of removedByRegion) {
      const region = filePreviousRegions.find(r => `${r.id}:${r.filePath}` === key)!;
      violations.push({ region, modifiedLine: lines[0], modifiedLines: lines, diffHunk: hunk.diffHunk });
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
      violation.region.severity,
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

function finalizeResult(result: CheckResult, failOn: PolicySeverity): CheckResult {
  const errorCount = result.violations.filter(violation => violation.region.severity === 'error').length;
  const warningCount = result.violations.filter(violation => violation.region.severity === 'warn').length;
  const blockingCount = failOn === 'warn' ? result.violations.length : errorCount;

  return {
    ...result,
    failOn,
    errorCount,
    warningCount,
    passed: blockingCount === 0,
  };
}

function getGitDiff(cwd: string, args: string[]): string {
  try {
    return execFileSync('git', args, {
      cwd,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
  } catch {
    return '';
  }
}

function getGitFileList(cwd: string, args: string[]): string[] {
  try {
    const output = execFileSync('git', args, {
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

function refExists(ref: string, cwd: string): boolean {
  try {
    execFileSync('git', ['rev-parse', '--verify', ref], {
      cwd,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return true;
  } catch {
    return false;
  }
}
