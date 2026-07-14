import * as fs from 'node:fs';
import * as path from 'node:path';
import { parseRepo } from './parser.js';
import type { GenerateOptions, ProtectedRegion } from './types.js';

export function generateInstructions(rootDir: string, options: GenerateOptions): string {
  const regions = parseRepo(rootDir);

  switch (options.format) {
    case 'claude-md':
      return generateClaudeMd(regions);
    case 'agents-md':
      return generateAgentsMd(regions);
    case 'cursor-rules':
      return generateCursorRules(regions);
    case 'cursor-mdc':
      return generateCursorMdc(regions);
    case 'gemini-md':
      return generateGeminiMd(regions);
    case 'copilot':
      return generateCopilotInstructions(regions);
    default:
      return generateAgentsMd(regions);
  }
}

function generateClaudeMd(regions: ProtectedRegion[]): string {
  if (regions.length === 0) {
    return '## Protected Code\n\nNo fenced regions found in this repository.\n';
  }

  const lines = ['## Protected Code Regions', '', 'The following code regions are fenced and must not be modified:', ''];
  for (const r of regions) {
    const relPath = path.relative(process.cwd(), r.filePath);
    const reason = r.reason ? ` — ${r.reason}` : '';
    lines.push(`- \`${relPath}:${r.startLine}-${r.endLine}\`${reason}`);
  }
  lines.push('');
  lines.push('These regions are marked with `@fence-begin`/`@fence-end` annotations.');
  lines.push('Do not modify code between these markers.');
  lines.push('');
  return lines.join('\n');
}

function generateAgentsMd(regions: ProtectedRegion[]): string {
  if (regions.length === 0) {
    return '## Code Protection\n\nNo fenced regions found in this repository.\n';
  }

  const lines = ['## Code Protection', '', 'Several code regions are marked with `@fence` annotations and must not be modified.', ''];
  lines.push('Run `npx snippetfence list` to see all protected regions.');
  lines.push('');
  lines.push('Do not modify code between `@fence-begin` and `@fence-end` markers.');
  lines.push('');
  return lines.join('\n');
}

function generateCursorRules(regions: ProtectedRegion[]): string {
  if (regions.length === 0) {
    return 'DO NOT modify code between @fence-begin and @fence-end markers. No regions currently fenced.';
  }

  const lines = ['DO NOT modify code between @fence-begin and @fence-end markers.', ''];
  lines.push('Run `npx snippetfence list` to see all protected regions.');
  lines.push('');
  for (const r of regions) {
    const relPath = path.relative(process.cwd(), r.filePath);
    const reason = r.reason ? ` (${r.reason})` : '';
    lines.push(`- ${relPath}:${r.startLine}-${r.endLine}${reason}`);
  }
  return lines.join('\n');
}

function generateCursorMdc(regions: ProtectedRegion[]): string {
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
    for (const r of regions) {
      const relPath = path.relative(process.cwd(), r.filePath);
      const reason = r.reason ? ` (${r.reason})` : '';
      lines.push(`- ${relPath}:${r.startLine}-${r.endLine}${reason}`);
    }
  } else {
    lines.push('No regions currently fenced.');
  }

  lines.push('');
  return lines.join('\n');
}

function generateGeminiMd(regions: ProtectedRegion[]): string {
  if (regions.length === 0) {
    return '## Code Protection\n\nNo fenced regions found in this repository.\n';
  }

  const lines = ['## Code Protection', '', 'Several code regions are marked with `@fence` annotations and must not be modified.', ''];
  lines.push('Run `npx snippetfence list` to see all protected regions.');
  lines.push('');
  lines.push('Do not modify code between `@fence-begin` and `@fence-end` markers.');
  lines.push('');
  return lines.join('\n');
}

function generateCopilotInstructions(regions: ProtectedRegion[]): string {
  if (regions.length === 0) {
    return '## Protected Code\n\nNo fenced regions found in this repository.\n';
  }

  const lines = ['## Protected Code', '', 'Do not modify code between `@fence-begin` and `@fence-end` markers.', ''];
  lines.push('Run `npx snippetfence list` to see all protected regions.');
  lines.push('');
  for (const r of regions) {
    const relPath = path.relative(process.cwd(), r.filePath);
    const reason = r.reason ? ` — ${r.reason}` : '';
    lines.push(`- \`${relPath}:${r.startLine}-${r.endLine}\`${reason}`);
  }
  lines.push('');
  return lines.join('\n');
}

export function writeGeneratedFile(rootDir: string, options: GenerateOptions): string {
  const content = generateInstructions(rootDir, options);
  const fileName = getOutputFileName(options.format);
  const outputPath = options.outputPath ?? path.join(rootDir, fileName);
  fs.writeFileSync(outputPath, content, 'utf-8');
  return outputPath;
}

function getOutputFileName(format: GenerateOptions['format']): string {
  switch (format) {
    case 'claude-md': return 'CLAUDE.md';
    case 'agents-md': return 'AGENTS.md';
    case 'cursor-rules': return '.cursorrules';
    case 'cursor-mdc': return '.cursor/rules/protect-fenced.mdc';
    case 'gemini-md': return 'GEMINI.md';
    case 'copilot': return '.github/copilot-instructions.md';
    default: return 'AGENTS.md';
  }
}
