export interface ProtectedRegion {
  id: string;
  startLine: number;
  endLine: number;
  filePath: string;
  reason?: string;
  severity: PolicySeverity;
  owners?: string[];
  tags?: string[];
  message?: string;
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
  failOn: PolicySeverity;
  errorCount: number;
  warningCount: number;
}

export type PolicySeverity = 'warn' | 'error';

export interface PolicyMetadata {
  severity?: PolicySeverity;
  owners?: string[];
  tags?: string[];
  message?: string;
}

export interface EffectivePolicy {
  severity: PolicySeverity;
  owners?: string[];
  tags?: string[];
  message?: string;
}

export interface LegacyConfig {
  exclude?: string[];
  include?: string[];
}

export interface ConfigRule extends PolicyMetadata {
  paths: string[];
}

export interface YamlConfig extends LegacyConfig {
  defaults?: PolicyMetadata;
  rules?: ConfigRule[];
}

export interface SnippetfenceConfig extends LegacyConfig {
  defaults?: PolicyMetadata;
  rules?: ConfigRule[];
  filePath?: string;
  format: 'none' | 'legacy' | 'yaml';
}

export interface ResolvedConfig {
  include: string[];
  exclude: string[];
  defaults: EffectivePolicy;
  rules: ConfigRule[];
  filePath?: string;
  format: 'none' | 'legacy' | 'yaml';
}

export interface ConfigValidationIssue {
  level: 'error' | 'warn';
  code: string;
  message: string;
  filePath?: string;
}

export interface ConfigValidationResult {
  valid: boolean;
  config: ResolvedConfig;
  issues: ConfigValidationIssue[];
}

export interface ValidateIssue {
  level: 'error' | 'warn';
  source: 'config' | 'fence';
  code: string;
  message: string;
  filePath: string;
  line?: number;
}

export interface ValidateResult {
  passed: boolean;
  issues: ValidateIssue[];
  filesChecked: number;
  regionsChecked: number;
}

export interface AddFenceOptions {
  startLine: number;
  endLine: number;
  reason?: string;
  style?: 'auto' | 'line' | 'block';
}

export interface AddFenceResult {
  filePath: string;
  beginLine: number;
  endLine: number;
  style: 'line' | 'block';
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
