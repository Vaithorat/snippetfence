import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { isGitRepo, getGitRoot, fileExists, readFileContent, findFiles } from '../src/utils.js';

function tmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'snippetfence-utils-'));
}

describe('isGitRepo', () => {
  it('returns true for a git repository', () => {
    const projectRoot = path.join(__dirname, '..');
    expect(isGitRepo(projectRoot)).toBe(true);
  });

  it('returns false for a non-git directory', () => {
    const dir = tmpDir();
    expect(isGitRepo(dir)).toBe(false);
    fs.rmSync(dir, { recursive: true });
  });
});

describe('getGitRoot', () => {
  it('returns the git root for a repo', () => {
    const projectRoot = path.join(__dirname, '..');
    const root = getGitRoot(projectRoot);
    expect(root).toBeTruthy();
    expect(fs.existsSync(root)).toBe(true);
  });

  it('returns cwd for non-git directory', () => {
    const dir = tmpDir();
    const root = getGitRoot(dir);
    expect(root).toBe(dir);
    fs.rmSync(dir, { recursive: true });
  });
});

describe('fileExists', () => {
  it('returns true for existing file', () => {
    expect(fileExists(path.join(__dirname, '..', 'package.json'))).toBe(true);
  });

  it('returns false for non-existing file', () => {
    expect(fileExists('/nonexistent/path/file.txt')).toBe(false);
  });
});

describe('readFileContent', () => {
  it('reads file content', () => {
    const projectRoot = path.join(__dirname, '..');
    const content = readFileContent(path.join(projectRoot, 'package.json'));
    expect(content).toContain('snippetfence');
  });
});

describe('findFiles', () => {
  it('finds files matching patterns', () => {
    const projectRoot = path.join(__dirname, '..');
    const files = findFiles(projectRoot, ['src/*.ts']);
    expect(files.length).toBeGreaterThan(0);
    expect(files.some(f => f.includes('parser.ts'))).toBe(true);
  });

  it('returns empty for non-matching patterns', () => {
    const projectRoot = path.join(__dirname, '..');
    const files = findFiles(projectRoot, ['**/*.xyz123']);
    expect(files).toHaveLength(0);
  });

  it('returns absolute paths', () => {
    const projectRoot = path.join(__dirname, '..');
    const files = findFiles(projectRoot, ['src/version.ts']);
    expect(files).toHaveLength(1);
    expect(path.isAbsolute(files[0])).toBe(true);
  });
});
