import * as fs from 'node:fs';
import * as path from 'node:path';
import fg from 'fast-glob';
import { DEFAULT_IGNORE, DEFAULT_INCLUDE, loadConfig, resolvePolicy, toRepoRelativePath, validateConfig } from './config.js';
import { getSyntaxForFile, getBeginPattern, getEndPattern } from './syntax.js';
import type { EffectivePolicy, FenceWarning, ProtectedRegion, ResolvedConfig } from './types.js';

export function parseFile(filePath: string, rootDir?: string): ProtectedRegion[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const projectRoot = rootDir ?? detectProjectRoot(filePath);
  const config = loadConfig(projectRoot);
  const policy = resolvePolicy(config, projectRoot, filePath);
  return parseContent(content, filePath, 0, policy);
}

export function parseContent(
  content: string,
  filePath: string,
  startCounter: number = 0,
  policy: EffectivePolicy = { severity: 'error' }
): ProtectedRegion[] {
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
    } else if (endRegex.test(line)) {
      counter++;
      regions.push(createRegion(counter, openRegion.startLine, lineNum, filePath, openRegion.reason, policy));
      openRegion = null;
    }
  }

  if (openRegion !== null) {
    const lastContentLine = lines.length > 0 && lines[lines.length - 1] === '' ? lines.length - 1 : lines.length;
    counter++;
    regions.push(createRegion(counter, openRegion.startLine, lastContentLine, filePath, openRegion.reason, policy));
  }

  return regions;
}

function createRegion(
  counter: number,
  startLine: number,
  endLine: number,
  filePath: string,
  reason: string | undefined,
  policy: EffectivePolicy
): ProtectedRegion {
  return {
    id: `region-${counter}`,
    startLine,
    endLine,
    filePath: path.resolve(filePath),
    reason,
    severity: policy.severity,
    owners: policy.owners ? [...policy.owners] : undefined,
    tags: policy.tags ? [...policy.tags] : undefined,
    message: policy.message,
  };
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
    } else if (endRegex.test(line)) {
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

    const trimmed = line.trim();
    const isComment = commentPrefixes.some(prefix => trimmed.startsWith(prefix));
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

export { DEFAULT_IGNORE, DEFAULT_INCLUDE };

export function getRepoFiles(rootDir: string, patterns?: string[], config?: ResolvedConfig): string[] {
  const resolvedConfig = config ?? loadConfig(rootDir);
  const includePatterns = patterns ?? resolvedConfig.include ?? DEFAULT_INCLUDE;
  return fg.sync(includePatterns, {
    cwd: rootDir,
    absolute: true,
    ignore: resolvedConfig.exclude ?? DEFAULT_IGNORE,
    dot: true,
  });
}

export function parseRepo(rootDir: string, patterns?: string[]): ProtectedRegion[] {
  const validation = validateConfig(rootDir);
  if (!validation.valid) {
    const firstError = validation.issues.find(issue => issue.level === 'error');
    throw new Error(firstError?.message ?? 'Invalid snippetfence configuration');
  }

  const files = getRepoFiles(rootDir, patterns, validation.config);
  const allRegions: ProtectedRegion[] = [];
  let counter = 0;

  for (const file of files) {
    try {
      const policy = resolvePolicy(validation.config, rootDir, file);
      const regions = parseContent(fs.readFileSync(file, 'utf-8'), file, counter, policy);
      counter += regions.length;
      allRegions.push(...regions);
    } catch {
      // Skip files that can't be read
    }
  }

  return allRegions;
}

export function validateRepo(rootDir: string, patterns?: string[]): FenceWarning[] {
  const files = getRepoFiles(rootDir, patterns, getSafeConfig(rootDir));
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

export function parseAndValidateRepo(rootDir: string, patterns?: string[]): { regions: ProtectedRegion[]; warnings: FenceWarning[]; filesChecked: number } {
  const config = getSafeConfig(rootDir);
  const files = getRepoFiles(rootDir, patterns, config);
  const allRegions: ProtectedRegion[] = [];
  const allWarnings: FenceWarning[] = [];
  let counter = 0;

  for (const file of files) {
    try {
      const content = fs.readFileSync(file, 'utf-8');
      const policy = resolvePolicy(config, rootDir, file);
      const regions = parseContent(content, file, counter, policy);
      counter += regions.length;
      allRegions.push(...regions);
      allWarnings.push(...validateFencesInContent(content, file));
    } catch {
      // Skip files that can't be read
    }
  }

  return { regions: allRegions, warnings: allWarnings, filesChecked: files.length };
}

function detectProjectRoot(filePath: string): string {
  let current = path.dirname(path.resolve(filePath));

  while (true) {
    if (
      fs.existsSync(path.join(current, YAML_CONFIG_FILE)) ||
      fs.existsSync(path.join(current, '.git')) ||
      fs.existsSync(path.join(current, '.snippetfencerules'))
    ) {
      return current;
    }

    const parent = path.dirname(current);
    if (parent === current) {
      return path.dirname(path.resolve(filePath));
    }
    current = parent;
  }
}

function getSafeConfig(rootDir: string): ResolvedConfig {
  const validation = validateConfig(rootDir);
  if (validation.valid) {
    return validation.config;
  }
  return loadConfigFallback(rootDir);
}

function loadConfigFallback(rootDir: string): ResolvedConfig {
  return {
    include: [...DEFAULT_INCLUDE],
    exclude: [...DEFAULT_IGNORE],
    defaults: { severity: 'error' },
    rules: [],
    format: 'none',
  };
}

const YAML_CONFIG_FILE = 'snippetfence.yml';

export function getRelativeRegionPath(rootDir: string, region: ProtectedRegion): string {
  return toRepoRelativePath(rootDir, region.filePath);
}
