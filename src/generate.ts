import * as fs from 'node:fs';
import * as path from 'node:path';
import { parseRepo } from './parser.js';
import type { GenerateOptions, ProtectedRegion } from './types.js';

const MANAGED_BEGIN = '<!-- snippetfence-managed-begin -->';
const MANAGED_END = '<!-- snippetfence-managed-end -->';

const MANAGED_FORMATS = new Set<GenerateOptions['format']>(['claude-md', 'agents-md', 'gemini-md', 'copilot']);

export function generateInstructions(rootDir: string, options: GenerateOptions): string {
  const regions = parseRepo(rootDir);

  switch (options.format) {
    case 'claude-md':
      return generateClaudeMd(regions, rootDir);
    case 'agents-md':
      return generateGenericMd('Code Protection', regions, rootDir);
    case 'cursor-rules':
      return generateCursorRules(regions, rootDir);
    case 'cursor-mdc':
      return generateCursorMdc(regions, rootDir);
    case 'gemini-md':
      return generateGeminiMd(regions, rootDir);
    case 'copilot':
      return generateCopilotInstructions(regions, rootDir);
    case 'windsurf':
      return generateWindsurfRules(regions, rootDir);
    case 'cline':
      return generateClineRules(regions, rootDir);
    default:
      return generateGenericMd('Code Protection', regions, rootDir);
  }
}

export function checkGeneratedFile(rootDir: string, options: GenerateOptions): { upToDate: boolean; outputPath: string } {
  const fileName = getOutputFileName(options.format);
  const outputPath = options.outputPath ?? path.join(rootDir, fileName);
  if (!fs.existsSync(outputPath)) return { upToDate: false, outputPath };
  const existing = fs.readFileSync(outputPath, 'utf-8');

  if (MANAGED_FORMATS.has(options.format)) {
    const before = extractBeforeManaged(existing);
    const after = extractAfterManaged(existing);
    const expected = before + wrapManaged(generateInstructions(rootDir, options)) + after;
    return { upToDate: existing === expected, outputPath };
  }

  const content = generateInstructions(rootDir, options);
  return { upToDate: existing === content, outputPath };
}

function relPath(filePath: string, rootDir: string): string {
  return path.relative(rootDir, filePath);
}

function generateRegionList(regions: ProtectedRegion[], rootDir: string): string[] {
  return regions.map(r => `- \`${relPath(r.filePath, rootDir)}:${r.startLine}-${r.endLine}\`${r.reason ? ` — ${r.reason}` : ''}`);
}

function generateRegionListInline(regions: ProtectedRegion[], rootDir: string): string[] {
  return regions.map(r => `- ${relPath(r.filePath, rootDir)}:${r.startLine}-${r.endLine}${r.reason ? ` (${r.reason})` : ''}`);
}

function generateClaudeMd(regions: ProtectedRegion[], rootDir: string): string {
  if (regions.length === 0) {
    return '## Protected Code\n\nNo fenced regions found in this repository.\n';
  }

  const lines = [
    '## Protected Code Regions',
    '',
    'The following code regions are fenced and must not be modified:',
    '',
    ...generateRegionList(regions, rootDir),
    '',
    'These regions are marked with `@fence-begin`/`@fence-end` annotations.',
    'Do not modify code between these markers.',
    '',
  ];
  return lines.join('\n');
}

function generateGenericMd(title: string, regions: ProtectedRegion[], rootDir: string): string {
  const h = `# ${title}`;
  if (regions.length === 0) {
    return `${h}\n\nNo fenced regions found in this repository.\n`;
  }

  const lines = [
    h,
    '',
    'Several code regions are marked with `@fence` annotations and must not be modified.',
    '',
    'Run `npx snippetfence list` to see all protected regions.',
    '',
    'Do not modify code between `@fence-begin` and `@fence-end` markers.',
    '',
    ...generateRegionList(regions, rootDir),
    '',
  ];
  return lines.join('\n');
}

function generateCursorRules(regions: ProtectedRegion[], rootDir: string): string {
  if (regions.length === 0) {
    return 'DO NOT modify code between @fence-begin and @fence-end markers. No regions currently fenced.';
  }

  const lines = [
    'DO NOT modify code between @fence-begin and @fence-end markers.',
    '',
    'Run `npx snippetfence list` to see all protected regions.',
    '',
    ...generateRegionListInline(regions, rootDir),
  ];
  return lines.join('\n');
}

function generateCursorMdc(regions: ProtectedRegion[], rootDir: string): string {
  const lines = [
    '---',
    'description: Fenced code protection - do not modify protected regions',
    'globs: "**"',
    'alwaysApply: true',
    '---',
    '',
    'DO NOT modify code between `@fence-begin` and `@fence-end` markers.',
    '',
  ];

  if (regions.length > 0) {
    lines.push('Run `npx snippetfence list` to see all protected regions.');
    lines.push('');
    lines.push(...generateRegionListInline(regions, rootDir));
  } else {
    lines.push('No regions currently fenced.');
  }

  lines.push('');
  return lines.join('\n');
}

function generateCopilotInstructions(regions: ProtectedRegion[], rootDir: string): string {
  if (regions.length === 0) {
    return '## Protected Code\n\nNo fenced regions found in this repository.\n';
  }

  const lines = [
    '## Protected Code',
    '',
    'Do not modify code between `@fence-begin` and `@fence-end` markers.',
    '',
    'Run `npx snippetfence list` to see all protected regions.',
    '',
    ...generateRegionList(regions, rootDir),
    '',
  ];
  return lines.join('\n');
}

function generateGeminiMd(regions: ProtectedRegion[], rootDir: string): string {
  if (regions.length === 0) {
    return '# Gemini Code Protection\n\nNo fenced regions found in this repository.\n';
  }

  const lines = [
    '# Gemini Code Protection',
    '',
    'CRITICAL: Do not modify code between `@fence-begin` and `@fence-end` markers.',
    'These regions contain security-sensitive or compliance-critical code.',
    '',
    ...generateRegionList(regions, rootDir),
    '',
    'If you need to modify a protected region, ask the user to remove the markers first.',
    '',
  ];
  return lines.join('\n');
}

function generateWindsurfRules(regions: ProtectedRegion[], rootDir: string): string {
  if (regions.length === 0) {
    return 'PROTECTED CODE: Do not modify code between @fence-begin and @fence-end markers. No regions currently fenced.';
  }

  const lines = [
    'PROTECTED CODE: Do not modify code between @fence-begin and @fence-end markers.',
    '',
    'These regions are annotated by snippetfence for code protection.',
    'Ask the user before suggesting any changes to fenced regions.',
    '',
    ...generateRegionListInline(regions, rootDir),
  ];
  return lines.join('\n');
}

function generateClineRules(regions: ProtectedRegion[], rootDir: string): string {
  if (regions.length === 0) {
    return '# SnippetFence Rules\n\nNo fenced regions found in this repository.\n';
  }

  const lines = [
    '# SnippetFence Rules',
    '',
    'You MUST NOT modify code between `@fence-begin` and `@fence-end` markers.',
    'These regions are protected and require explicit user approval to change.',
    '',
    'Run `npx snippetfence list` to see all protected regions.',
    '',
    'Protected regions:',
    '',
    ...generateRegionList(regions, rootDir),
    '',
    'If a task requires modifying a fenced region, inform the user which regions are affected and ask for confirmation.',
    '',
  ];
  return lines.join('\n');
}

export function writeGeneratedFile(rootDir: string, options: GenerateOptions): string {
  const content = generateInstructions(rootDir, options);
  const fileName = getOutputFileName(options.format);
  const outputPath = options.outputPath ?? path.join(rootDir, fileName);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });

  if (MANAGED_FORMATS.has(options.format)) {
    if (fs.existsSync(outputPath)) {
      const existing = fs.readFileSync(outputPath, 'utf-8');
      const before = extractBeforeManaged(existing);
      const after = extractAfterManaged(existing);
      const managed = wrapManaged(content);
      fs.writeFileSync(outputPath, before + managed + after, 'utf-8');
    } else {
      fs.writeFileSync(outputPath, wrapManaged(content), 'utf-8');
    }
  } else {
    fs.writeFileSync(outputPath, content, 'utf-8');
  }

  return outputPath;
}

function extractBeforeManaged(content: string): string {
  const idx = content.indexOf(MANAGED_BEGIN);
  return idx === -1 ? content : content.slice(0, idx);
}

function extractAfterManaged(content: string): string {
  const idx = content.indexOf(MANAGED_END);
  if (idx === -1) return '';
  const rest = content.slice(idx + MANAGED_END.length);
  return rest.length > 0 && rest[0] !== '\n' ? '\n' + rest : rest;
}

function wrapManaged(content: string): string {
  return `${MANAGED_BEGIN}\n${content}${MANAGED_END}`;
}

function getOutputFileName(format: GenerateOptions['format']): string {
  switch (format) {
    case 'claude-md': return 'CLAUDE.md';
    case 'agents-md': return 'AGENTS.md';
    case 'cursor-rules': return '.cursorrules';
    case 'cursor-mdc': return '.cursor/rules/protect-fenced.mdc';
    case 'gemini-md': return 'GEMINI.md';
    case 'copilot': return '.github/copilot-instructions.md';
    case 'windsurf': return '.windsurfrules';
    case 'cline': return '.clinerules/snippetfence.md';
    default: return 'AGENTS.md';
  }
}
