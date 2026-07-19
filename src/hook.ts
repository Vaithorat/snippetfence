import * as fs from 'node:fs';
import * as path from 'node:path';
import { execFileSync } from 'node:child_process';
import * as yaml from 'yaml';
import type { HookManager } from './types.js';

export function detectHookManager(cwd: string): HookManager {
  if (fs.existsSync(path.join(cwd, '.husky', 'pre-commit'))) return 'husky';
  if (fs.existsSync(path.join(cwd, '.husky'))) {
    const huskyFiles = fs.readdirSync(path.join(cwd, '.husky'));
    if (huskyFiles.length > 0) return 'husky';
  }
  if (fs.existsSync(path.join(cwd, '.pre-commit-config.yaml'))) return 'pre-commit';
  if (fs.existsSync(path.join(cwd, 'lefthook.yml')) || fs.existsSync(path.join(cwd, 'lefthook.yaml'))) return 'lefthook';
  if (fs.existsSync(path.join(cwd, '.git', 'hooks', 'pre-commit'))) return 'raw';
  return 'none';
}

export function isSnippetfenceHookInstalled(cwd: string, manager?: HookManager): boolean {
  const mgr = manager ?? detectHookManager(cwd);

  switch (mgr) {
    case 'husky':
      return readHookIfExists(path.join(cwd, '.husky', 'pre-commit')).includes('snippetfence');
    case 'pre-commit':
      return readHookIfExists(path.join(cwd, '.pre-commit-config.yaml')).includes('snippetfence');
    case 'lefthook':
      return readHookIfExists(getLefthookConfigPath(cwd)).includes('snippetfence');
    case 'raw':
      return readHookIfExists(path.join(cwd, '.git', 'hooks', 'pre-commit')).includes('snippetfence');
    default:
      return false;
  }
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
      return {
        success: false,
        message: 'No hook manager detected. Run `snippetfence init --manager raw` to install a raw pre-commit hook, or set up husky/pre-commit/lefthook first.',
      };
    default:
      return { success: false, message: `Unknown hook manager: ${mgr}` };
  }
}

function installHuskyHook(cwd: string): { success: boolean; message: string } {
  const huskyDir = path.join(cwd, '.husky');
  fs.mkdirSync(huskyDir, { recursive: true });

  const hookPath = path.join(huskyDir, 'pre-commit');
  const snippetfenceCmd = 'npx snippetfence check';
  const shellHeader = '#!/usr/bin/env sh\n';

  let content = fs.existsSync(hookPath) ? fs.readFileSync(hookPath, 'utf-8') : '';
  const alreadyInstalled = content.includes('snippetfence');
  if (!content.startsWith('#!')) {
    content = shellHeader + content.replace(/^\s+/, '');
  }
  if (!alreadyInstalled) {
    content = content.trimEnd() + '\n' + snippetfenceCmd + '\n';
  }

  fs.writeFileSync(hookPath, content, 'utf-8');

  try {
    fs.chmodSync(hookPath, 0o755);
  } catch {
    // Ignore on Windows
  }

  try {
    const current = execFileSync('git', ['config', 'core.hooksPath'], {
      cwd,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
    if (current !== '.husky') {
      execFileSync('git', ['config', 'core.hooksPath', '.husky'], { cwd, stdio: 'pipe' });
    }
  } catch {
    try {
      execFileSync('git', ['config', 'core.hooksPath', '.husky'], { cwd, stdio: 'pipe' });
    } catch {
      // Not in a git repo
    }
  }

  return {
    success: true,
    message: alreadyInstalled
      ? 'SnippetFence hook already installed in .husky/pre-commit'
      : 'SnippetFence hook installed in .husky/pre-commit',
  };
}

const SNIPPETFENCE_PRE_COMMIT_ENTRY = {
  repo: 'local',
  hooks: [
    {
      id: 'snippetfence',
      name: 'SnippetFence - Protected code regions',
      entry: 'npx --no-install snippetfence check',
      language: 'system',
      stages: ['pre-commit'],
    },
  ],
};

function installPreCommitHook(cwd: string): { success: boolean; message: string } {
  const configPath = path.join(cwd, '.pre-commit-config.yaml');

  if (fs.existsSync(configPath)) {
    const existing = fs.readFileSync(configPath, 'utf-8');
    if (existing.includes('snippetfence')) {
      return { success: true, message: 'SnippetFence hook already in .pre-commit-config.yaml' };
    }

    let doc: yaml.Document;
    try {
      doc = yaml.parseDocument(existing);
    } catch {
      return { success: false, message: 'Failed to parse .pre-commit-config.yaml — please fix YAML syntax first' };
    }

    const repos = doc.get('repos');
    if (!yaml.isSeq(repos)) {
      return { success: false, message: '.pre-commit-config.yaml does not have a "repos" sequence — cannot append' };
    }

    repos.items.push(yaml.parseDocument(yaml.stringify(SNIPPETFENCE_PRE_COMMIT_ENTRY)).contents as yaml.Node);
    fs.writeFileSync(configPath, doc.toString(), 'utf-8');
  } else {
    const doc = new yaml.Document({ repos: [SNIPPETFENCE_PRE_COMMIT_ENTRY] });
    fs.writeFileSync(configPath, doc.toString(), 'utf-8');
  }

  return { success: true, message: 'SnippetFence hook added to .pre-commit-config.yaml' };
}

const SNIPPETFENCE_LEFTHOOK_ENTRY: Record<string, unknown> = {
  'pre-commit': {
    jobs: [
      {
        name: 'snippetfence',
        run: 'npx snippetfence check',
      },
    ],
  },
};

function installLefthookHook(cwd: string): { success: boolean; message: string } {
  const configPath = getLefthookConfigPath(cwd);

  if (fs.existsSync(configPath)) {
    const existing = fs.readFileSync(configPath, 'utf-8');
    if (existing.includes('snippetfence')) {
      return { success: true, message: `SnippetFence hook already in ${path.basename(configPath)}` };
    }

    let doc: yaml.Document;
    try {
      doc = yaml.parseDocument(existing);
    } catch {
      return { success: false, message: `Failed to parse ${path.basename(configPath)} — please fix YAML syntax first` };
    }

    const lefthookPreCommit = SNIPPETFENCE_LEFTHOOK_ENTRY['pre-commit'] as { jobs: Array<Record<string, unknown>> };
    const existingPreCommit = doc.get('pre-commit');
    if (yaml.isMap(existingPreCommit)) {
      const jobs = existingPreCommit.get('jobs');
      if (yaml.isSeq(jobs)) {
        jobs.items.push(yaml.parseDocument(yaml.stringify(lefthookPreCommit.jobs[0])).contents as yaml.Node);
      } else {
        existingPreCommit.set('jobs', yaml.parse(yaml.stringify(lefthookPreCommit.jobs)));
      }
    } else {
      doc.set('pre-commit', yaml.parse(yaml.stringify(lefthookPreCommit)));
    }

    fs.writeFileSync(configPath, doc.toString(), 'utf-8');
  } else {
    const doc = new yaml.Document(SNIPPETFENCE_LEFTHOOK_ENTRY);
    fs.writeFileSync(configPath, doc.toString(), 'utf-8');
  }

  return { success: true, message: `SnippetFence hook added to ${path.basename(configPath)}` };
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

function getLefthookConfigPath(cwd: string): string {
  const yamlPath = path.join(cwd, 'lefthook.yaml');
  if (fs.existsSync(yamlPath)) {
    return yamlPath;
  }

  return path.join(cwd, 'lefthook.yml');
}

function readHookIfExists(filePath: string): string {
  if (!fs.existsSync(filePath)) {
    return '';
  }

  try {
    return fs.readFileSync(filePath, 'utf-8');
  } catch {
    return '';
  }
}
