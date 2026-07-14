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
  format: 'claude-md' | 'agents-md' | 'cursor-rules' | 'cursor-mdc' | 'gemini-md' | 'copilot';
  outputPath?: string;
}

export type HookManager = 'husky' | 'pre-commit' | 'lefthook' | 'raw' | 'none';

export interface SyntaxStyle {
  lineComment?: string;
  blockComment?: [string, string];
}
