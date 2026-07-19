import { parseFile, parseRepo, parseAndValidateRepo, validateFences, validateRepo } from './parser.js';
import { checkAllChanges, checkStagedChanges, checkWorkingTreeChanges } from './enforcer.js';
import { installHook } from './hook.js';
import { generateInstructions, writeGeneratedFile } from './generate.js';
import { isGitRepo, getGitRoot } from './utils.js';
import { runDoctor } from './doctor.js';
import { loadConfig, hasConfig } from './config.js';
import { VERSION } from './version.js';

export async function startMcpServer(): Promise<void> {
  const { startMcpServer: start } = await import('./mcp-server.js');
  return start();
}

export {
  parseFile,
  parseRepo,
  parseAndValidateRepo,
  validateFences,
  validateRepo,
  checkStagedChanges,
  checkAllChanges,
  checkWorkingTreeChanges,
  installHook,
  generateInstructions,
  writeGeneratedFile,
  isGitRepo,
  getGitRoot,
  runDoctor,
  loadConfig,
  hasConfig,
  VERSION,
};

export type {
  ProtectedRegion,
  Violation,
  CheckResult,
  GenerateOptions,
  HookManager,
  SyntaxStyle,
  FenceWarning,
  DoctorResult,
} from './types.js';
