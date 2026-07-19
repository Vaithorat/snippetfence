import * as fs from 'node:fs';
import * as path from 'node:path';
import fg from 'fast-glob';
import { getSyntaxForFile, getBeginPattern, getEndPattern } from './syntax.js';
import type { ProtectedRegion, FenceWarning } from './types.js';
import { loadConfig } from './config.js';

export function parseFile(filePath: string): ProtectedRegion[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  return parseContent(content, filePath);
}

export function parseContent(content: string, filePath: string, startCounter: number = 0): ProtectedRegion[] {
  const syntax = getSyntaxForFile(filePath);
  const beginRegex = getBeginPattern(syntax);
  const endRegex = getEndPattern(syntax);
  const lines = content.split('\n');
  const regions: ProtectedRegion[] = [];
  let openRegion: { startLine: number; reason?: string } | null = null;
  let counter = startCounter;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;

    if (openRegion === null) {
      const beginMatch = beginRegex.exec(line);
      if (beginMatch) {
        openRegion = { startLine: lineNum, reason: getFenceReason(beginMatch) };
      }
    } else {
      if (endRegex.test(line)) {
        counter++;
        regions.push({
          id: `region-${counter}`,
          startLine: openRegion.startLine,
          endLine: lineNum,
          filePath: path.resolve(filePath),
          reason: openRegion.reason,
        });
        openRegion = null;
      }
    }
  }

  if (openRegion !== null) {
    const lastContentLine = lines.length > 0 && lines[lines.length - 1] === '' ? lines.length - 1 : lines.length;
    counter++;
    regions.push({
      id: `region-${counter}`,
      startLine: openRegion.startLine,
      endLine: lastContentLine,
      filePath: path.resolve(filePath),
      reason: openRegion.reason,
    });
  }

  return regions;
}

function getFenceReason(beginMatch: RegExpExecArray): string | undefined {
  const reason = beginMatch[1] ?? beginMatch[2];
  return reason?.trim() || undefined;
}

const TYPO_PATTERNS = [
  { typo: /@fence-bgin/, correct: '@fence-begin' },
  { typo: /@fence-begn/, correct: '@fence-begin' },
  { typo: /@fence-ben\b/, correct: '@fence-begin' },
  { typo: /@fence-edn/, correct: '@fence-end' },
  { typo: /@fence-nd\b/, correct: '@fence-end' },
  { typo: /@fence-ed\b/, correct: '@fence-end' },
];

export function validateFences(filePath: string): FenceWarning[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  return validateFencesInContent(content, filePath);
}

export function validateFencesInContent(content: string, filePath: string): FenceWarning[] {
  const syntax = getSyntaxForFile(filePath);
  const beginRegex = getBeginPattern(syntax);
  const endRegex = getEndPattern(syntax);
  const lines = content.split('\n');
  const warnings: FenceWarning[] = [];
  let openRegion: { startLine: number } | null = null;

  const commentPrefixes: string[] = [];
  if (syntax.lineComment) commentPrefixes.push(syntax.lineComment);
  if (syntax.blockComment) commentPrefixes.push(syntax.blockComment[0]);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;

    if (openRegion === null) {
      const beginMatch = beginRegex.exec(line);
      if (beginMatch) {
        openRegion = { startLine: lineNum };
      }
    } else {
      if (endRegex.test(line)) {
        openRegion = null;
      } else {
        const nestedBegin = beginRegex.exec(line);
        if (nestedBegin) {
          warnings.push({
            type: 'nested',
            message: `Nested @fence-begin at line ${lineNum} while region from line ${openRegion.startLine} is still open`,
            line: lineNum,
            filePath,
          });
        }
      }
    }

    const trimmed = line.trim();
    const isComment = commentPrefixes.some(p => trimmed.startsWith(p));
    if (isComment) {
      for (const { typo, correct } of TYPO_PATTERNS) {
        if (typo.test(line)) {
          warnings.push({
            type: 'typo',
            message: `Possible typo at line ${lineNum}: did you mean "${correct}"?`,
            line: lineNum,
            filePath,
          });
        }
      }
    }
  }

  if (openRegion !== null) {
    warnings.push({
      type: 'unclosed',
      message: `Unclosed @fence-begin at line ${openRegion.startLine} (extends to end of file)`,
      line: openRegion.startLine,
      filePath,
    });
  }

  return warnings;
}

export const DEFAULT_IGNORE = ['**/node_modules/**', '**/dist/**', '**/.git/**', '**/build/**'];
const DEFAULT_PATTERNS = ['**/*.{ts,tsx,js,jsx,go,rs,py,java,c,cpp,cs,swift,kt,scala,php,sql,html,xml,vue,svelte,lua,hs,yaml,yml,toml,sh,bash,r,rb,pl,ini,mjs,cjs,scss,css}'];

function getRepoFiles(rootDir: string, patterns?: string[]): string[] {
  const config = loadConfig(rootDir);
  const ignore = [...DEFAULT_IGNORE, ...(config.exclude ?? [])];
  const includePatterns = config.include ?? (patterns ?? DEFAULT_PATTERNS);
  return fg.sync(includePatterns, {
    cwd: rootDir,
    absolute: true,
    ignore,
  });
}

export function parseRepo(rootDir: string, patterns?: string[]): ProtectedRegion[] {
  const files = getRepoFiles(rootDir, patterns);
  const allRegions: ProtectedRegion[] = [];
  let counter = 0;
  for (const file of files) {
    try {
      const regions = parseContent(fs.readFileSync(file, 'utf-8'), file, counter);
      counter += regions.length;
      allRegions.push(...regions);
    } catch {
      // Skip files that can't be read
    }
  }
  return allRegions;
}

export function validateRepo(rootDir: string, patterns?: string[]): FenceWarning[] {
  const files = getRepoFiles(rootDir, patterns);
  const allWarnings: FenceWarning[] = [];
  for (const file of files) {
    try {
      allWarnings.push(...validateFencesInContent(fs.readFileSync(file, 'utf-8'), file));
    } catch {
      // Skip files that can't be read
    }
  }
  return allWarnings;
}

export function parseAndValidateRepo(rootDir: string, patterns?: string[]): { regions: ProtectedRegion[]; warnings: FenceWarning[] } {
  const files = getRepoFiles(rootDir, patterns);
  const allRegions: ProtectedRegion[] = [];
  const allWarnings: FenceWarning[] = [];
  let counter = 0;

  for (const file of files) {
    try {
      const content = fs.readFileSync(file, 'utf-8');
      const regions = parseContent(content, file, counter);
      counter += regions.length;
      allRegions.push(...regions);
      allWarnings.push(...validateFencesInContent(content, file));
    } catch {
      // Skip files that can't be read
    }
  }

  return { regions: allRegions, warnings: allWarnings };
}
