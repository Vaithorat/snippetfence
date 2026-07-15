import * as path from 'node:path';
import { isGitRepo } from './utils.js';
import { detectHookManager } from './hook.js';
import { parseAndValidateRepo } from './parser.js';
import type { DoctorResult } from './types.js';

export function runDoctor(cwd: string): DoctorResult {
  const gitRepo = isGitRepo(cwd);
  const hookManager = detectHookManager(cwd);
  const hookInstalled = hookManager !== 'none';

  const { regions, warnings } = parseAndValidateRepo(cwd);

  return {
    gitRepo,
    hookInstalled,
    hookManager,
    fencesValid: warnings.length === 0,
    warnings,
    protectedRegions: regions.length,
  };
}
