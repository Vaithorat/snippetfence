import { parseFile, parseRepo, parseAndValidateRepo, validateFences, validateRepo } from './parser.js';
import { addFence } from './add.js';
import { checkAllChanges, checkRefChanges, checkStagedChanges, checkWorkingTreeChanges } from './enforcer.js';
import { validateRepository } from './validate.js';
import { installHook } from './hook.js';
import { generateInstructions, writeGeneratedFile, checkGeneratedFile } from './generate.js';
import { isGitRepo, getGitRoot } from './utils.js';
import { runDoctor } from './doctor.js';
import { loadConfig, hasConfig, validateConfig } from './config.js';
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
  addFence,
  checkStagedChanges,
  checkAllChanges,
  checkRefChanges,
  checkWorkingTreeChanges,
  validateRepository,
  installHook,
  generateInstructions,
  writeGeneratedFile,
  checkGeneratedFile,
  isGitRepo,
  getGitRoot,
  runDoctor,
  loadConfig,
  hasConfig,
  validateConfig,
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
  AddFenceOptions,
  AddFenceResult,
  ConfigRule,
  ConfigValidationIssue,
  ConfigValidationResult,
  EffectivePolicy,
  LegacyConfig,
  PolicyMetadata,
  PolicySeverity,
  ResolvedConfig,
  SnippetfenceConfig,
  ValidateIssue,
  ValidateResult,
} from './types.js';
