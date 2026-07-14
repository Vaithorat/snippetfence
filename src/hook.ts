import * as fs from 'node:fs';
import * as path from 'node:path';
import { execSync } from 'node:child_process';
import type { HookManager } from './types.js';

export function detectHookManager(cwd: string): HookManager {
  if (fs.existsSync(path.join(cwd, '.husky', 'pre-commit'))) return 'husky';
  if (fs.existsSync(path.join(cwd, '.husky'))) return 'husky';
  if (fs.existsSync(path.join(cwd, '.pre-commit-config.yaml'))) return 'pre-commit';
  if (fs.existsSync(path.join(cwd, 'lefthook.yml')) || fs.existsSync(path.join(cwd, 'lefthook.yaml'))) return 'lefthook';
  if (fs.existsSync(path.join(cwd, '.git', 'hooks', 'pre-commit'))) return 'raw';
  return 'none';
}

export function installHook(cwd: string, manager?: HookManager): { success: boolean; message: string } {
  const mgr = manager ?? detectHookManager(cwd);

  switch (mgr) {
    case 'husky':
      return installHuskyHook(cwd);
    case 'pre-commit':
      return installPreCommitHook(cwd);
    case 'lefthook':
      return installLefthookHook(cwd);
    case 'raw':
      return installRawHook(cwd);
    case 'none':
      return installRawHook(cwd);
    default:
      return { success: false, message: `Unknown hook manager: ${mgr}` };
  }
}

function installHuskyHook(cwd: string): { success: boolean; message: string } {
  const huskyDir = path.join(cwd, '.husky');
  fs.mkdirSync(huskyDir, { recursive: true });

  const hookPath = path.join(huskyDir, 'pre-commit');
  const snippetfenceCmd = 'npx snippetfence check';

  if (fs.existsSync(hookPath)) {
    const existing = fs.readFileSync(hookPath, 'utf-8');
    if (existing.includes('snippetfence')) {
      return { success: true, message: 'SnippetFence hook already installed in .husky/pre-commit' };
    }
    fs.writeFileSync(hookPath, existing.trimEnd() + '\n' + snippetfenceCmd + '\n', 'utf-8');
  } else {
    fs.writeFileSync(hookPath, snippetfenceCmd + '\n', 'utf-8');
  }

  try {
    execSync('git config core.hooksPath .husky', { cwd, stdio: 'pipe' });
  } catch {
    // Ignore - may not be in a git repo during testing
  }

  return { success: true, message: 'SnippetFence hook installed in .husky/pre-commit' };
}

function installPreCommitHook(cwd: string): { success: boolean; message: string } {
  const configPath = path.join(cwd, '.pre-commit-config.yaml');
  const hookEntry = `
- repo: local
  hooks:
    - id: snippetfence
      name: SnippetFence - Protected code regions
      entry: npx snippetfence check
      language: system
      stages: [pre-commit]
`;

  if (fs.existsSync(configPath)) {
    const existing = fs.readFileSync(configPath, 'utf-8');
    if (existing.includes('snippetfence')) {
      return { success: true, message: 'SnippetFence hook already in .pre-commit-config.yaml' };
    }
    fs.writeFileSync(configPath, existing.trimEnd() + '\n' + hookEntry, 'utf-8');
  } else {
    fs.writeFileSync(configPath, 'repos:' + hookEntry, 'utf-8');
  }

  return { success: true, message: 'SnippetFence hook added to .pre-commit-config.yaml' };
}

function installLefthookHook(cwd: string): { success: boolean; message: string } {
  const configPath = path.join(cwd, 'lefthook.yml');
  const hookEntry = `
pre-commit:
  jobs:
    - name: snippetfence
      run: npx snippetfence check
`;

  if (fs.existsSync(configPath)) {
    const existing = fs.readFileSync(configPath, 'utf-8');
    if (existing.includes('snippetfence')) {
      return { success: true, message: 'SnippetFence hook already in lefthook.yml' };
    }
    fs.writeFileSync(configPath, existing.trimEnd() + '\n' + hookEntry, 'utf-8');
  } else {
    fs.writeFileSync(configPath, hookEntry.trimStart(), 'utf-8');
  }

  return { success: true, message: 'SnippetFence hook added to lefthook.yml' };
}

function installRawHook(cwd: string): { success: boolean; message: string } {
  const hooksDir = path.join(cwd, '.git', 'hooks');
  if (!fs.existsSync(hooksDir)) {
    return { success: false, message: 'No .git/hooks directory found. Are you in a git repository?' };
  }

  const hookPath = path.join(hooksDir, 'pre-commit');
  const snippetfenceCmd = '# SnippetFence - Protected code regions\nnpx snippetfence check\n';

  if (fs.existsSync(hookPath)) {
    const existing = fs.readFileSync(hookPath, 'utf-8');
    if (existing.includes('snippetfence')) {
      return { success: true, message: 'SnippetFence hook already in .git/hooks/pre-commit' };
    }
    fs.writeFileSync(hookPath, existing.trimEnd() + '\n' + snippetfenceCmd, 'utf-8');
  } else {
    fs.writeFileSync(hookPath, '#!/bin/sh\n' + snippetfenceCmd, 'utf-8');
  }

  try {
    fs.chmodSync(hookPath, 0o755);
  } catch {
    // Ignore on Windows
  }

  return { success: true, message: 'SnippetFence hook installed in .git/hooks/pre-commit' };
}
