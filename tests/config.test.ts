import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { parseConfig, loadConfig, hasConfig, getConfigFilePath } from '../src/config.js';

function tmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'snippetfence-config-'));
}

describe('parseConfig', () => {
  it('parses exclude section', () => {
    const content = `
[exclude]
node_modules/
dist/
build/
`;
    const config = parseConfig(content);
    expect(config.exclude).toEqual(['node_modules/', 'dist/', 'build/']);
  });

  it('parses include section', () => {
    const content = `
[include]
*.ts
*.js
`;
    const config = parseConfig(content);
    expect(config.include).toEqual(['*.ts', '*.js']);
  });

  it('parses both sections', () => {
    const content = `
[exclude]
vendor/

[include]
src/**/*.ts
`;
    const config = parseConfig(content);
    expect(config.exclude).toEqual(['vendor/']);
    expect(config.include).toEqual(['src/**/*.ts']);
  });

  it('ignores comments', () => {
    const content = `
# This is a comment
[exclude]
# Another comment
node_modules/
`;
    const config = parseConfig(content);
    expect(config.exclude).toEqual(['node_modules/']);
  });

  it('ignores blank lines', () => {
    const content = `
[exclude]

node_modules/

dist/

`;
    const config = parseConfig(content);
    expect(config.exclude).toEqual(['node_modules/', 'dist/']);
  });

  it('returns empty object for empty content', () => {
    const config = parseConfig('');
    expect(config.exclude).toBeUndefined();
    expect(config.include).toBeUndefined();
  });

  it('ignores lines before any section', () => {
    const content = `
some random text
[exclude]
vendor/
`;
    const config = parseConfig(content);
    expect(config.exclude).toEqual(['vendor/']);
  });
});

describe('loadConfig', () => {
  it('returns empty when no config file exists', () => {
    const dir = tmpDir();
    const config = loadConfig(dir);
    expect(config).toEqual({});
    fs.rmSync(dir, { recursive: true });
  });

  it('loads config from .snippetfencerules', () => {
    const dir = tmpDir();
    fs.writeFileSync(path.join(dir, '.snippetfencerules'), '[exclude]\nvendor/\n');
    const config = loadConfig(dir);
    expect(config.exclude).toEqual(['vendor/']);
    fs.rmSync(dir, { recursive: true });
  });

  it('returns empty for unreadable config file', () => {
    const dir = tmpDir();
    // Create a file and then make it unreadable if possible
    const configPath = path.join(dir, '.snippetfencerules');
    fs.writeFileSync(configPath, '[exclude]\nfoo\n');
    // Should still parse successfully
    const config = loadConfig(dir);
    expect(config.exclude).toEqual(['foo']);
    fs.rmSync(dir, { recursive: true });
  });
});

describe('hasConfig', () => {
  it('returns false when no config file exists', () => {
    const dir = tmpDir();
    expect(hasConfig(dir)).toBe(false);
    fs.rmSync(dir, { recursive: true });
  });

  it('returns true when config file exists', () => {
    const dir = tmpDir();
    fs.writeFileSync(path.join(dir, '.snippetfencerules'), '');
    expect(hasConfig(dir)).toBe(true);
    fs.rmSync(dir, { recursive: true });
  });
});

describe('getConfigFilePath', () => {
  it('returns path to .snippetfencerules', () => {
    const dir = tmpDir();
    const expected = path.join(dir, '.snippetfencerules');
    expect(getConfigFilePath(dir)).toBe(expected);
    fs.rmSync(dir, { recursive: true });
  });
});
