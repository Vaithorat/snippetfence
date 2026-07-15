import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { detectHookManager, installHook } from '../src/hook.js';

function tmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'snippetfence-hook-'));
}

describe('detectHookManager', () => {
  it('returns none for empty directory', () => {
    const dir = tmpDir();
    expect(detectHookManager(dir)).toBe('none');
    fs.rmSync(dir, { recursive: true });
  });

  it('detects husky when .husky/pre-commit exists', () => {
    const dir = tmpDir();
    fs.mkdirSync(path.join(dir, '.husky'));
    fs.writeFileSync(path.join(dir, '.husky', 'pre-commit'), 'npx snippetfence check\n');
    expect(detectHookManager(dir)).toBe('husky');
    fs.rmSync(dir, { recursive: true });
  });

  it('detects husky when .husky has files but no pre-commit', () => {
    const dir = tmpDir();
    fs.mkdirSync(path.join(dir, '.husky'));
    fs.writeFileSync(path.join(dir, '.husky', 'commit-msg'), 'echo ok\n');
    expect(detectHookManager(dir)).toBe('husky');
    fs.rmSync(dir, { recursive: true });
  });

  it('returns none for empty .husky directory', () => {
    const dir = tmpDir();
    fs.mkdirSync(path.join(dir, '.husky'));
    expect(detectHookManager(dir)).toBe('none');
    fs.rmSync(dir, { recursive: true });
  });

  it('detects pre-commit framework', () => {
    const dir = tmpDir();
    fs.writeFileSync(path.join(dir, '.pre-commit-config.yaml'), 'repos: []\n');
    expect(detectHookManager(dir)).toBe('pre-commit');
    fs.rmSync(dir, { recursive: true });
  });

  it('detects lefthook (yml)', () => {
    const dir = tmpDir();
    fs.writeFileSync(path.join(dir, 'lefthook.yml'), 'pre-commit:\n  jobs: []\n');
    expect(detectHookManager(dir)).toBe('lefthook');
    fs.rmSync(dir, { recursive: true });
  });

  it('detects lefthook (yaml)', () => {
    const dir = tmpDir();
    fs.writeFileSync(path.join(dir, 'lefthook.yaml'), 'pre-commit:\n  jobs: []\n');
    expect(detectHookManager(dir)).toBe('lefthook');
    fs.rmSync(dir, { recursive: true });
  });

  it('detects raw hook', () => {
    const dir = tmpDir();
    fs.mkdirSync(path.join(dir, '.git', 'hooks'), { recursive: true });
    fs.writeFileSync(path.join(dir, '.git', 'hooks', 'pre-commit'), '#!/bin/sh\necho ok\n');
    expect(detectHookManager(dir)).toBe('raw');
    fs.rmSync(dir, { recursive: true });
  });

  it('prefers husky over pre-commit', () => {
    const dir = tmpDir();
    fs.mkdirSync(path.join(dir, '.husky'));
    fs.writeFileSync(path.join(dir, '.husky', 'pre-commit'), 'npx snippetfence check\n');
    fs.writeFileSync(path.join(dir, '.pre-commit-config.yaml'), 'repos: []\n');
    expect(detectHookManager(dir)).toBe('husky');
    fs.rmSync(dir, { recursive: true });
  });
});

describe('installHook', () => {
  it('returns error for none manager', () => {
    const dir = tmpDir();
    const result = installHook(dir, 'none');
    expect(result.success).toBe(false);
    expect(result.message).toContain('No hook manager detected');
    fs.rmSync(dir, { recursive: true });
  });

  it('installs husky hook', () => {
    const dir = tmpDir();
    const result = installHook(dir, 'husky');
    expect(result.success).toBe(true);
    const hookContent = fs.readFileSync(path.join(dir, '.husky', 'pre-commit'), 'utf-8');
    expect(hookContent).toContain('snippetfence');
    fs.rmSync(dir, { recursive: true });
  });

  it('is idempotent for husky', () => {
    const dir = tmpDir();
    installHook(dir, 'husky');
    const result2 = installHook(dir, 'husky');
    expect(result2.success).toBe(true);
    expect(result2.message).toContain('already installed');
    fs.rmSync(dir, { recursive: true });
  });

  it('installs raw hook', () => {
    const dir = tmpDir();
    fs.mkdirSync(path.join(dir, '.git', 'hooks'), { recursive: true });
    const result = installHook(dir, 'raw');
    expect(result.success).toBe(true);
    const hookPath = path.join(dir, '.git', 'hooks', 'pre-commit');
    expect(fs.existsSync(hookPath)).toBe(true);
    const content = fs.readFileSync(hookPath, 'utf-8');
    expect(content).toContain('#!/bin/sh');
    expect(content).toContain('snippetfence');
    fs.rmSync(dir, { recursive: true });
  });

  it('installs lefthook hook', () => {
    const dir = tmpDir();
    const result = installHook(dir, 'lefthook');
    expect(result.success).toBe(true);
    const content = fs.readFileSync(path.join(dir, 'lefthook.yml'), 'utf-8');
    expect(content).toContain('snippetfence');
    fs.rmSync(dir, { recursive: true });
  });

  it('installs pre-commit framework hook', () => {
    const dir = tmpDir();
    const result = installHook(dir, 'pre-commit');
    expect(result.success).toBe(true);
    const content = fs.readFileSync(path.join(dir, '.pre-commit-config.yaml'), 'utf-8');
    expect(content).toContain('snippetfence');
    expect(content).toContain('repos:');
    fs.rmSync(dir, { recursive: true });
  });

  it('returns error for raw hook without .git/hooks', () => {
    const dir = tmpDir();
    const result = installHook(dir, 'raw');
    expect(result.success).toBe(false);
    expect(result.message).toContain('.git/hooks');
    fs.rmSync(dir, { recursive: true });
  });

  it('appends to existing husky hook without snippetfence', () => {
    const dir = tmpDir();
    fs.mkdirSync(path.join(dir, '.husky'));
    fs.writeFileSync(path.join(dir, '.husky', 'pre-commit'), 'npx prettier --check .\n');
    const result = installHook(dir, 'husky');
    expect(result.success).toBe(true);
    const content = fs.readFileSync(path.join(dir, '.husky', 'pre-commit'), 'utf-8');
    expect(content).toContain('npx prettier --check .');
    expect(content).toContain('npx snippetfence check');
    fs.rmSync(dir, { recursive: true });
  });

  it('appends to existing pre-commit config with repos', () => {
    const dir = tmpDir();
    const existing = 'repos:\n  - repo: https://github.com/pre-commit/pre-commit-hooks\n    rev: v4.0.0\n';
    fs.writeFileSync(path.join(dir, '.pre-commit-config.yaml'), existing);
    const result = installHook(dir, 'pre-commit');
    expect(result.success).toBe(true);
    const content = fs.readFileSync(path.join(dir, '.pre-commit-config.yaml'), 'utf-8');
    expect(content).toContain('pre-commit-hooks');
    expect(content).toContain('snippetfence');
    expect(content).toContain('- repo: local');
    expect(content).toMatch(/repos:\n\s+- repo:/);
    fs.rmSync(dir, { recursive: true });
  });

  it('appends to existing raw hook without snippetfence', () => {
    const dir = tmpDir();
    fs.mkdirSync(path.join(dir, '.git', 'hooks'), { recursive: true });
    fs.writeFileSync(path.join(dir, '.git', 'hooks', 'pre-commit'), '#!/bin/sh\necho "running hooks"\n');
    const result = installHook(dir, 'raw');
    expect(result.success).toBe(true);
    const content = fs.readFileSync(path.join(dir, '.git', 'hooks', 'pre-commit'), 'utf-8');
    expect(content).toContain('echo "running hooks"');
    expect(content).toContain('snippetfence');
    fs.rmSync(dir, { recursive: true });
  });
});
