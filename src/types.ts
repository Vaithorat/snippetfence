export interface ProtectedRegion {
  id: string;
  startLine: number;
  endLine: number;
  filePath: string;
  reason?: string;
}

export interface Violation {
  region: ProtectedRegion;
  modifiedLine: number;
  diffHunk: string;
}

export interface CheckResult {
  passed: boolean;
  violations: Violation[];
  filesChecked: number;
  regionsChecked: number;
}

export interface GenerateOptions {
  format: 'claude-md' | 'agents-md' | 'cursor-rules' | 'cursor-mdc' | 'gemini-md' | 'copilot' | 'windsurf' | 'cline';
  outputPath?: string;
}

export type HookManager = 'husky' | 'pre-commit' | 'lefthook' | 'raw' | 'none';

export interface SyntaxStyle {
  lineComment?: string;
  blockComment?: [string, string];
}

export interface FenceWarning {
  type: 'unclosed' | 'nested' | 'typo';
  message: string;
  line: number;
  filePath: string;
}

export interface DoctorResult {
  gitRepo: boolean;
  hookInstalled: boolean;
  hookManager: HookManager;
  fencesValid: boolean;
  warnings: FenceWarning[];
  protectedRegions: number;
}
