import { execSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import fg from 'fast-glob';

export function isGitRepo(cwd: string): boolean {
  try {
    execSync('git rev-parse --git-dir', { cwd, stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

export function getGitRoot(cwd: string): string {
  try {
    return execSync('git rev-parse --show-toplevel', {
      cwd,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
  } catch {
    return cwd;
  }
}

export function fileExists(filePath: string): boolean {
  try {
    fs.accessSync(filePath);
    return true;
  } catch {
    return false;
  }
}

export function readFileContent(filePath: string): string {
  return fs.readFileSync(filePath, 'utf-8');
}

export function findFiles(rootDir: string, patterns: string[]): string[] {
  return fg.sync(patterns, {
    cwd: rootDir,
    absolute: true,
    ignore: ['**/node_modules/**', '**/dist/**', '**/.git/**', '**/build/**'],
  });
}
