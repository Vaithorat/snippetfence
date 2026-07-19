import * as fs from 'node:fs';
import * as path from 'node:path';
import fg from 'fast-glob';
import { parseDocument } from 'yaml';
import type {
  ConfigRule,
  ConfigValidationIssue,
  ConfigValidationResult,
  EffectivePolicy,
  LegacyConfig,
  PolicyMetadata,
  PolicySeverity,
  ResolvedConfig,
  SnippetfenceConfig,
  YamlConfig,
} from './types.js';

export const LEGACY_CONFIG_FILE = '.snippetfencerules';
export const YAML_CONFIG_FILE = 'snippetfence.yml';
export const DEFAULT_IGNORE = ['**/node_modules/**', '**/dist/**', '**/.git/**', '**/build/**'];
export const DEFAULT_INCLUDE = ['**/*.{ts,tsx,js,jsx,go,rs,py,java,c,cpp,cs,swift,kt,scala,php,sql,html,xml,vue,svelte,lua,hs,yaml,yml,toml,sh,bash,r,rb,pl,ini,mjs,cjs,scss,css}'];

const TOP_LEVEL_KEYS = new Set(['defaults', 'exclude', 'include', 'rules']);
const POLICY_KEYS = new Set(['severity', 'owners', 'tags', 'message']);
const RULE_KEYS = new Set(['paths', ...POLICY_KEYS]);

export function parseConfig(content: string): LegacyConfig {
  const config: LegacyConfig = {};
  const lines = content.split('\n');
  let currentSection: 'exclude' | 'include' | null = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    if (trimmed === '[exclude]') {
      currentSection = 'exclude';
      continue;
    }
    if (trimmed === '[include]') {
      currentSection = 'include';
      continue;
    }

    if (currentSection === 'exclude') {
      config.exclude ??= [];
      config.exclude.push(trimmed);
    } else if (currentSection === 'include') {
      config.include ??= [];
      config.include.push(trimmed);
    }
  }

  return config;
}

export function loadConfig(cwd: string): ResolvedConfig {
  return validateConfig(cwd).config;
}

export function validateConfig(cwd: string): ConfigValidationResult {
  const yamlPath = path.join(cwd, YAML_CONFIG_FILE);
  const legacyPath = path.join(cwd, LEGACY_CONFIG_FILE);

  if (fs.existsSync(yamlPath)) {
    return validateYamlConfig(cwd, yamlPath);
  }

  if (fs.existsSync(legacyPath)) {
    return validateLegacyConfig(legacyPath);
  }

  return {
    valid: true,
    config: createResolvedConfig({ format: 'none' }),
    issues: [],
  };
}

export function getConfigFilePath(cwd: string): string {
  const yamlPath = path.join(cwd, YAML_CONFIG_FILE);
  if (fs.existsSync(yamlPath)) {
    return yamlPath;
  }
  return path.join(cwd, LEGACY_CONFIG_FILE);
}

export function hasConfig(cwd: string): boolean {
  return fs.existsSync(path.join(cwd, YAML_CONFIG_FILE)) || fs.existsSync(path.join(cwd, LEGACY_CONFIG_FILE));
}

export function resolvePolicy(config: ResolvedConfig, rootDir: string, filePath: string): EffectivePolicy {
  const relPath = toRepoRelativePath(rootDir, filePath);
  let policy: EffectivePolicy = { ...config.defaults };

  for (const rule of config.rules) {
    if (matchesAnyPattern(relPath, rule.paths)) {
      policy = mergePolicy(policy, rule);
    }
  }

  return policy;
}

export function matchesAnyPattern(filePath: string, patterns: string[]): boolean {
  return patterns.some(pattern => matchesPattern(filePath, pattern));
}

export function matchesPattern(filePath: string, pattern: string): boolean {
  const normalizedFile = normalizePath(filePath);
  for (const expanded of expandBraces(normalizePattern(pattern))) {
    if (compileGlob(expanded).test(normalizedFile)) {
      return true;
    }
  }
  return false;
}

export function findMatchingFiles(rootDir: string, pattern: string): string[] {
  return fg.sync(pattern, {
    cwd: rootDir,
    absolute: false,
    dot: true,
    onlyFiles: false,
    suppressErrors: false,
  }).map(normalizePath);
}

export function validateGlobPattern(pattern: string): void {
  for (const expanded of expandBraces(normalizePattern(pattern))) {
    compileGlob(expanded);
  }
}

export function toRepoRelativePath(rootDir: string, filePath: string): string {
  return normalizePath(path.relative(rootDir, path.resolve(filePath)));
}

function validateLegacyConfig(configPath: string): ConfigValidationResult {
  const content = fs.readFileSync(configPath, 'utf-8');
  const config = parseConfig(content);
  const rawConfig: SnippetfenceConfig = {
    ...config,
    format: 'legacy',
    filePath: configPath,
  };
  const issues = validateNormalizedConfig(rawConfig, path.dirname(configPath));
  return {
    valid: !issues.some(issue => issue.level === 'error'),
    config: createResolvedConfig(rawConfig),
    issues,
  };
}

function validateYamlConfig(cwd: string, configPath: string): ConfigValidationResult {
  const content = fs.readFileSync(configPath, 'utf-8');
  const issues: ConfigValidationIssue[] = [];
  const document = parseDocument(content);

  for (const error of document.errors) {
    issues.push({
      level: 'error',
      code: 'invalid-yaml',
      message: error.message,
      filePath: configPath,
    });
  }

  if (issues.some(issue => issue.level === 'error')) {
    return {
      valid: false,
      config: createResolvedConfig({ format: 'yaml', filePath: configPath }),
      issues,
    };
  }

  const value = document.toJS();
  if (value === null || value === undefined) {
    return {
      valid: true,
      config: createResolvedConfig({ format: 'yaml', filePath: configPath }),
      issues,
    };
  }

  if (!isRecord(value)) {
    return {
      valid: false,
      config: createResolvedConfig({ format: 'yaml', filePath: configPath }),
      issues: [...issues, {
        level: 'error',
        code: 'invalid-config-shape',
        message: 'snippetfence.yml must contain a YAML object at the top level',
        filePath: configPath,
      }],
    };
  }

  const rawConfig = normalizeYamlConfig(value, configPath);
  issues.push(...validateNormalizedConfig(rawConfig, cwd, value));

  return {
    valid: !issues.some(issue => issue.level === 'error'),
    config: createResolvedConfig(rawConfig),
    issues,
  };
}

function normalizeYamlConfig(value: Record<string, unknown>, configPath: string): SnippetfenceConfig {
  const config: SnippetfenceConfig = {
    format: 'yaml',
    filePath: configPath,
  };

  if (Array.isArray(value.include)) {
    config.include = value.include.filter((entry): entry is string => typeof entry === 'string');
  }
  if (Array.isArray(value.exclude)) {
    config.exclude = value.exclude.filter((entry): entry is string => typeof entry === 'string');
  }
  if (isRecord(value.defaults)) {
    config.defaults = normalizePolicy(value.defaults);
  }
  if (Array.isArray(value.rules)) {
    config.rules = value.rules.filter(isRecord).map(rule => ({
      paths: Array.isArray(rule.paths) ? rule.paths.filter((entry): entry is string => typeof entry === 'string') : [],
      ...normalizePolicy(rule),
    }));
  }

  return config;
}

function validateNormalizedConfig(
  config: SnippetfenceConfig,
  cwd: string,
  rawValue?: Record<string, unknown>
): ConfigValidationIssue[] {
  const issues: ConfigValidationIssue[] = [];
  const filePath = config.filePath;

  if (config.format === 'yaml' && filePath && rawValue) {
    for (const key of Object.keys(rawValue)) {
      if (!TOP_LEVEL_KEYS.has(key)) {
        issues.push({
          level: 'error',
          code: 'unknown-top-level-key',
          message: `Unknown top-level key "${key}" in ${YAML_CONFIG_FILE}`,
          filePath,
        });
      }
    }

    if (rawValue.defaults !== undefined && !isRecord(rawValue.defaults)) {
      issues.push({
        level: 'error',
        code: 'invalid-defaults',
        message: 'defaults must be an object',
        filePath,
      });
    }

    if (rawValue.rules !== undefined && !Array.isArray(rawValue.rules)) {
      issues.push({
        level: 'error',
        code: 'invalid-rules',
        message: 'rules must be an array',
        filePath,
      });
    }

    if (Array.isArray(rawValue.rules)) {
      rawValue.rules.forEach((rule, index) => {
        if (!isRecord(rule)) {
          issues.push({
            level: 'error',
            code: 'invalid-rule',
            message: `rules[${index}] must be an object`,
            filePath,
          });
          return;
        }

        for (const key of Object.keys(rule)) {
          if (!RULE_KEYS.has(key)) {
            issues.push({
              level: 'error',
              code: 'unknown-rule-key',
              message: `Unknown key "${key}" in rules[${index}]`,
              filePath,
            });
          }
        }

        if (!Array.isArray(rule.paths) || rule.paths.some(entry => typeof entry !== 'string')) {
          issues.push({
            level: 'error',
            code: 'invalid-rule-paths',
            message: `rules[${index}].paths must be an array of strings`,
            filePath,
          });
        }

        issues.push(...validatePolicyShape(rule, `rules[${index}]`, filePath));
      });
    }

    if (isRecord(rawValue.defaults)) {
      for (const key of Object.keys(rawValue.defaults)) {
        if (!POLICY_KEYS.has(key)) {
          issues.push({
            level: 'error',
            code: 'unknown-default-key',
            message: `Unknown key "${key}" in defaults`,
            filePath,
          });
        }
      }
      issues.push(...validatePolicyShape(rawValue.defaults, 'defaults', filePath));
    }
  }

  for (const field of ['include', 'exclude'] as const) {
    const patterns = config[field];
    if (!patterns) continue;

    if (!Array.isArray(patterns) || patterns.some(pattern => typeof pattern !== 'string')) {
      issues.push({
        level: 'error',
        code: `invalid-${field}`,
        message: `${field} must be an array of strings`,
        filePath,
      });
      continue;
    }

    for (const pattern of patterns) {
      try {
        validateGlobPattern(pattern);
      } catch (error) {
        issues.push({
          level: 'error',
          code: 'invalid-glob',
          message: `Invalid glob pattern "${pattern}": ${error instanceof Error ? error.message : String(error)}`,
          filePath,
        });
      }
    }
  }

  if (config.defaults) {
    issues.push(...validatePolicyShape(config.defaults as Record<string, unknown>, 'defaults', filePath));
  }

  if (config.rules) {
    const seenRuleSets = new Set<string>();
    for (const rule of config.rules) {
      let ruleHasInvalidGlob = false;

      if (!rule.paths.length) {
        issues.push({
          level: 'error',
          code: 'empty-rule-paths',
          message: 'Each rule must define at least one path',
          filePath,
        });
        continue;
      }

      for (const pattern of rule.paths) {
        try {
          validateGlobPattern(pattern);
        } catch (error) {
          ruleHasInvalidGlob = true;
          issues.push({
            level: 'error',
            code: 'invalid-glob',
            message: `Invalid glob pattern "${pattern}": ${error instanceof Error ? error.message : String(error)}`,
            filePath,
          });
        }
      }

      issues.push(...validatePolicyShape(rule as unknown as Record<string, unknown>, `rule ${rule.paths.join(', ')}`, filePath));

      const ruleKey = rule.paths.map(normalizePattern).sort().join('|');
      if (seenRuleSets.has(ruleKey)) {
        issues.push({
          level: 'warn',
          code: 'duplicate-rule-paths',
          message: `Multiple rules target the same path set: ${rule.paths.join(', ')}`,
          filePath,
        });
      }
      seenRuleSets.add(ruleKey);

      if (!ruleHasInvalidGlob) {
        const matchedFiles = new Set<string>();
        for (const pattern of rule.paths) {
          for (const match of findMatchingFiles(cwd, pattern)) {
            matchedFiles.add(match);
          }
        }
        if (matchedFiles.size === 0) {
          issues.push({
            level: 'warn',
            code: 'unmatched-rule',
            message: `Rule does not match any files: ${rule.paths.join(', ')}`,
            filePath,
          });
        }
      }
    }
  }

  return issues;
}

function validatePolicyShape(value: Record<string, unknown>, label: string, filePath?: string): ConfigValidationIssue[] {
  const issues: ConfigValidationIssue[] = [];

  if (value.severity !== undefined && value.severity !== 'warn' && value.severity !== 'error') {
    issues.push({
      level: 'error',
      code: 'invalid-severity',
      message: `${label}.severity must be "warn" or "error"`,
      filePath,
    });
  }

  for (const field of ['owners', 'tags'] as const) {
    const list = value[field];
    if (list !== undefined && (!Array.isArray(list) || list.some(entry => typeof entry !== 'string'))) {
      issues.push({
        level: 'error',
        code: `invalid-${field}`,
        message: `${label}.${field} must be an array of strings`,
        filePath,
      });
    }
  }

  if (value.message !== undefined && typeof value.message !== 'string') {
    issues.push({
      level: 'error',
      code: 'invalid-message',
      message: `${label}.message must be a string`,
      filePath,
    });
  }

  return issues;
}

function normalizePolicy(value: Record<string, unknown>): PolicyMetadata {
  const policy: PolicyMetadata = {};

  if (value.severity === 'warn' || value.severity === 'error') {
    policy.severity = value.severity;
  }
  if (Array.isArray(value.owners)) {
    policy.owners = value.owners.filter((entry): entry is string => typeof entry === 'string');
  }
  if (Array.isArray(value.tags)) {
    policy.tags = value.tags.filter((entry): entry is string => typeof entry === 'string');
  }
  if (typeof value.message === 'string') {
    policy.message = value.message;
  }

  return policy;
}

function createResolvedConfig(config: Partial<SnippetfenceConfig>): ResolvedConfig {
  return {
    include: config.include && config.include.length > 0 ? [...config.include] : [...DEFAULT_INCLUDE],
    exclude: [...DEFAULT_IGNORE, ...(config.exclude ?? [])],
    defaults: mergePolicy({ severity: 'error' }, config.defaults),
    rules: (config.rules ?? []).map(rule => ({
      paths: [...rule.paths],
      severity: rule.severity,
      owners: rule.owners ? [...rule.owners] : undefined,
      tags: rule.tags ? [...rule.tags] : undefined,
      message: rule.message,
    })),
    filePath: config.filePath,
    format: config.format ?? 'none',
  };
}

function mergePolicy(base: EffectivePolicy, override?: PolicyMetadata): EffectivePolicy {
  return {
    severity: override?.severity ?? base.severity,
    owners: override?.owners ? [...override.owners] : base.owners ? [...base.owners] : undefined,
    tags: override?.tags ? [...override.tags] : base.tags ? [...base.tags] : undefined,
    message: override?.message ?? base.message,
  };
}

function normalizePattern(pattern: string): string {
  const normalized = normalizePath(pattern.trim()).replace(/^\.\//, '');
  if (normalized.endsWith('/')) {
    return `${normalized}**`;
  }
  return normalized;
}

function normalizePath(filePath: string): string {
  return filePath.replace(/\\/g, '/');
}

function expandBraces(pattern: string): string[] {
  const start = pattern.indexOf('{');
  if (start === -1) return [pattern];

  let depth = 0;
  for (let i = start; i < pattern.length; i++) {
    const char = pattern[i];
    if (char === '{') depth++;
    if (char === '}') {
      depth--;
      if (depth === 0) {
        const prefix = pattern.slice(0, start);
        const suffix = pattern.slice(i + 1);
        const body = pattern.slice(start + 1, i);
        if (!body) {
          throw new Error('empty brace expansion');
        }
        return body.split(',').flatMap(part => expandBraces(`${prefix}${part}${suffix}`));
      }
    }
  }

  throw new Error('unclosed brace expansion');
}

function compileGlob(pattern: string): RegExp {
  let regex = '^';

  for (let i = 0; i < pattern.length; i++) {
    const char = pattern[i];

    if (char === '*') {
      const next = pattern[i + 1];
      if (next === '*') {
        const after = pattern[i + 2];
        if (after === '/') {
          regex += '(?:.*\/)?';
          i += 2;
        } else {
          regex += '.*';
          i += 1;
        }
      } else {
        regex += '[^/]*';
      }
      continue;
    }

    if (char === '?') {
      regex += '[^/]';
      continue;
    }

    if (char === '[') {
      const end = pattern.indexOf(']', i + 1);
      if (end === -1) {
        throw new Error('unclosed character class');
      }
      const body = pattern.slice(i + 1, end);
      if (!body) {
        throw new Error('empty character class');
      }
      regex += `[${body}]`;
      i = end;
      continue;
    }

    if (char === ']') {
      throw new Error('unexpected closing bracket');
    }

    regex += escapeRegex(char);
  }

  regex += '$';
  return new RegExp(regex);
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
