import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { hasConfig, getConfigFilePath, loadConfig, matchesPattern, parseConfig, resolvePolicy, validateConfig } from '../src/config.js';

function tmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'snippetfence-config-'));
}

describe('parseConfig', () => {
  it('parses exclude section', () => {
    const config = parseConfig('\n[exclude]\nnode_modules/\ndist/\nbuild/\n');
    expect(config.exclude).toEqual(['node_modules/', 'dist/', 'build/']);
  });

  it('parses include section', () => {
    const config = parseConfig('\n[include]\n*.ts\n*.js\n');
    expect(config.include).toEqual(['*.ts', '*.js']);
  });

  it('parses both sections', () => {
    const config = parseConfig('\n[exclude]\nvendor/\n\n[include]\nsrc/**/*.ts\n');
    expect(config.exclude).toEqual(['vendor/']);
    expect(config.include).toEqual(['src/**/*.ts']);
  });

  it('ignores comments and blank lines', () => {
    const config = parseConfig('\n# comment\n[exclude]\n\nnode_modules/\n# more\n');
    expect(config.exclude).toEqual(['node_modules/']);
  });
});

describe('loadConfig', () => {
  it('returns normalized defaults when no config file exists', () => {
    const dir = tmpDir();
    const config = loadConfig(dir);
    expect(config.format).toBe('none');
    expect(config.defaults.severity).toBe('error');
    expect(config.rules).toEqual([]);
    expect(config.include.length).toBeGreaterThan(0);
    expect(config.exclude).toContain('**/node_modules/**');
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('loads config from .snippetfencerules', () => {
    const dir = tmpDir();
    fs.writeFileSync(path.join(dir, '.snippetfencerules'), '[exclude]\nvendor/\n');
    const config = loadConfig(dir);
    expect(config.format).toBe('legacy');
    expect(config.exclude).toEqual(expect.arrayContaining(['vendor/']));
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('prefers snippetfence.yml over .snippetfencerules', () => {
    const dir = tmpDir();
    fs.writeFileSync(path.join(dir, '.snippetfencerules'), '[exclude]\nlegacy-only/\n');
    fs.writeFileSync(path.join(dir, 'snippetfence.yml'), 'exclude:\n  - yaml-only/\n');
    const config = loadConfig(dir);
    expect(config.format).toBe('yaml');
    expect(config.exclude).toEqual(expect.arrayContaining(['yaml-only/']));
    expect(config.exclude).not.toEqual(expect.arrayContaining(['legacy-only/']));
    fs.rmSync(dir, { recursive: true, force: true });
  });
});

describe('validateConfig', () => {
  it('parses valid YAML config', () => {
    const dir = tmpDir();
    fs.writeFileSync(path.join(dir, 'snippetfence.yml'), [
      'defaults:',
      '  severity: warn',
      'rules:',
      '  - paths:',
      '      - "src/payments/**"',
      '    severity: error',
      '    owners:',
      '      - security',
      '    tags:',
      '      - pci',
      '    message: Requires security review',
      '',
    ].join('\n'));

    const result = validateConfig(dir);
    expect(result.valid).toBe(true);
    expect(result.config.defaults.severity).toBe('warn');
    expect(result.config.rules[0].owners).toEqual(['security']);
    expect(result.config.rules[0].tags).toEqual(['pci']);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('rejects invalid YAML', () => {
    const dir = tmpDir();
    fs.writeFileSync(path.join(dir, 'snippetfence.yml'), 'defaults: [oops\n');
    const result = validateConfig(dir);
    expect(result.valid).toBe(false);
    expect(result.issues.some(issue => issue.code === 'invalid-yaml')).toBe(true);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('rejects unknown top-level keys', () => {
    const dir = tmpDir();
    fs.writeFileSync(path.join(dir, 'snippetfence.yml'), 'unknown: true\n');
    const result = validateConfig(dir);
    expect(result.valid).toBe(false);
    expect(result.issues.some(issue => issue.code === 'unknown-top-level-key')).toBe(true);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('warns when a rule never matches any files', () => {
    const dir = tmpDir();
    fs.mkdirSync(path.join(dir, 'src'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'src', 'index.ts'), 'export const x = 1;\n');
    fs.writeFileSync(path.join(dir, 'snippetfence.yml'), 'rules:\n  - paths:\n      - "missing/**"\n');
    const result = validateConfig(dir);
    expect(result.valid).toBe(true);
    expect(result.issues.some(issue => issue.code === 'unmatched-rule')).toBe(true);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('still reports unmatched valid rules when another rule has an invalid glob', () => {
    const dir = tmpDir();
    fs.mkdirSync(path.join(dir, 'src'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'src', 'index.ts'), 'export const x = 1;\n');
    fs.writeFileSync(path.join(dir, 'snippetfence.yml'), [
      'rules:',
      '  - paths:',
      '      - "src/[bad"',
      '  - paths:',
      '      - "missing/**"',
      '',
    ].join('\n'));

    const result = validateConfig(dir);
    expect(result.valid).toBe(false);
    expect(result.issues.some(issue => issue.code === 'invalid-glob')).toBe(true);
    expect(result.issues.some(issue => issue.code === 'unmatched-rule')).toBe(true);
    fs.rmSync(dir, { recursive: true, force: true });
  });
});

describe('policy matching', () => {
  it('matches glob patterns including brace expansion', () => {
    expect(matchesPattern('src/file.ts', 'src/*.{ts,js}')).toBe(true);
    expect(matchesPattern('src/file.py', 'src/*.{ts,js}')).toBe(false);
    expect(matchesPattern('src/nested/file.ts', 'src/**/*.ts')).toBe(true);
  });

  it('resolves defaults and matching rules in declaration order', () => {
    const dir = tmpDir();
    fs.writeFileSync(path.join(dir, 'snippetfence.yml'), [
      'defaults:',
      '  severity: warn',
      '  owners:',
      '    - core',
      'rules:',
      '  - paths:',
      '      - "src/**"',
      '    tags:',
      '      - shared',
      '  - paths:',
      '      - "src/payments/**"',
      '    severity: error',
      '    owners:',
      '      - security',
      '    message: Requires security review',
      '',
    ].join('\n'));

    const config = loadConfig(dir);
    const policy = resolvePolicy(config, dir, path.join(dir, 'src', 'payments', 'gateway.ts'));
    expect(policy.severity).toBe('error');
    expect(policy.owners).toEqual(['security']);
    expect(policy.tags).toEqual(['shared']);
    expect(policy.message).toBe('Requires security review');
    fs.rmSync(dir, { recursive: true, force: true });
  });
});

describe('config file helpers', () => {
  it('returns false when no config file exists', () => {
    const dir = tmpDir();
    expect(hasConfig(dir)).toBe(false);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('returns true when config file exists', () => {
    const dir = tmpDir();
    fs.writeFileSync(path.join(dir, 'snippetfence.yml'), 'defaults: {}\n');
    expect(hasConfig(dir)).toBe(true);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('returns the YAML config path when present', () => {
    const dir = tmpDir();
    const expected = path.join(dir, 'snippetfence.yml');
    fs.writeFileSync(expected, 'defaults: {}\n');
    expect(getConfigFilePath(dir)).toBe(expected);
    fs.rmSync(dir, { recursive: true, force: true });
  });
});
