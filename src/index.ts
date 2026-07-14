import { parseFile, parseRepo, resetCounter } from './parser.js';
import { checkStagedChanges } from './enforcer.js';
import { installHook } from './hook.js';
import { generateInstructions, writeGeneratedFile } from './generate.js';
import { startMcpServer } from './mcp-server.js';
import { isGitRepo, getGitRoot } from './utils.js';

export {
  parseFile,
  parseRepo,
  resetCounter,
  checkStagedChanges,
  installHook,
  generateInstructions,
  writeGeneratedFile,
  startMcpServer,
  isGitRepo,
  getGitRoot,
};

export type {
  ProtectedRegion,
  Violation,
  CheckResult,
  GenerateOptions,
  HookManager,
  SyntaxStyle,
} from './types.js';
