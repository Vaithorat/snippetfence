import { describe, it, expect } from 'vitest';
import * as path from 'node:path';
import * as fs from 'node:fs';
import * as os from 'node:os';
import { fileURLToPath } from 'node:url';
import { generateInstructions, writeGeneratedFile, checkGeneratedFile } from '../src/generate.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = path.join(__dirname, 'fixtures');

describe('generateInstructions', () => {
  it('generates CLAUDE.md format with regions from fixtures', () => {
    const result = generateInstructions(FIXTURES_DIR, { format: 'claude-md' });
    expect(result).toContain('## Protected Code Regions');
    expect(result).toContain('@fence-begin');
    expect(result).toContain('@fence-end');
  });

  it('generates AGENTS.md format with region list', () => {
    const result = generateInstructions(FIXTURES_DIR, { format: 'agents-md' });
    expect(result).toContain('# Code Protection');
    expect(result).toContain('snippetfence list');
    expect(result).toContain('simple.ts');
  });

  it('generates cursor rules format', () => {
    const result = generateInstructions(FIXTURES_DIR, { format: 'cursor-rules' });
    expect(result).toContain('DO NOT modify code between @fence-begin and @fence-end');
  });

  it('generates cursor mdc format with frontmatter', () => {
    const result = generateInstructions(FIXTURES_DIR, { format: 'cursor-mdc' });
    expect(result).toContain('---');
    expect(result).toContain('alwaysApply: true');
    expect(result).toContain('globs: "**"');
  });

  it('generates GEMINI.md format with region list', () => {
    const result = generateInstructions(FIXTURES_DIR, { format: 'gemini-md' });
    expect(result).toContain('Gemini Code Protection');
    expect(result).toContain('simple.ts');
  });

  it('generates copilot instructions format', () => {
    const result = generateInstructions(FIXTURES_DIR, { format: 'copilot' });
    expect(result).toContain('## Protected Code');
  });

  it('handles empty regions gracefully (non-existent dir)', () => {
    const result = generateInstructions('/nonexistent-dir-12345', { format: 'agents-md' });
    expect(result).toContain('No fenced regions found');
  });
});

describe('writeGeneratedFile', () => {
  it('writes file to disk and returns output path', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'snippetfence-gen-'));
    const outputPath = writeGeneratedFile(tmpDir, { format: 'agents-md' });
    expect(fs.existsSync(outputPath)).toBe(true);
    const content = fs.readFileSync(outputPath, 'utf-8');
    expect(content).toContain('Code Protection');
    fs.rmSync(tmpDir, { recursive: true });
  });

  it('writes claude-md format to CLAUDE.md', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'snippetfence-gen-'));
    const outputPath = writeGeneratedFile(tmpDir, { format: 'claude-md' });
    expect(outputPath).toContain('CLAUDE.md');
    expect(fs.existsSync(outputPath)).toBe(true);
    fs.rmSync(tmpDir, { recursive: true });
  });

  it('respects custom outputPath', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'snippetfence-gen-'));
    const customPath = path.join(tmpDir, 'CUSTOM.md');
    const outputPath = writeGeneratedFile(tmpDir, { format: 'agents-md', outputPath: customPath });
    expect(outputPath).toBe(customPath);
    expect(fs.existsSync(outputPath)).toBe(true);
    fs.rmSync(tmpDir, { recursive: true });
  });

  it('wraps managed content in markers for .md formats', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'snippetfence-gen-'));
    writeGeneratedFile(tmpDir, { format: 'agents-md' });
    const content = fs.readFileSync(path.join(tmpDir, 'AGENTS.md'), 'utf-8');
    expect(content).toContain('<!-- snippetfence-managed-begin -->');
    expect(content).toContain('<!-- snippetfence-managed-end -->');
    fs.rmSync(tmpDir, { recursive: true });
  });

  it('preserves non-managed content outside markers', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'snippetfence-gen-'));
    const preamble = '# My Project\n\nCustom instructions go here.\n\n';
    fs.writeFileSync(path.join(tmpDir, 'AGENTS.md'), preamble, 'utf-8');
    writeGeneratedFile(tmpDir, { format: 'agents-md' });
    const content = fs.readFileSync(path.join(tmpDir, 'AGENTS.md'), 'utf-8');
    expect(content).toContain('# My Project');
    expect(content).toContain('Custom instructions go here.');
    expect(content).toContain('<!-- snippetfence-managed-begin -->');
    expect(content).toContain('<!-- snippetfence-managed-end -->');
    expect(content.startsWith(preamble)).toBe(true);
    fs.rmSync(tmpDir, { recursive: true });
  });

  it('overwrites fully for non-managed formats', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'snippetfence-gen-'));
    fs.writeFileSync(path.join(tmpDir, '.cursorrules'), 'old content\n', 'utf-8');
    writeGeneratedFile(tmpDir, { format: 'cursor-rules' });
    const content = fs.readFileSync(path.join(tmpDir, '.cursorrules'), 'utf-8');
    expect(content).not.toContain('old content');
    expect(content).toContain('DO NOT modify code between @fence-begin and @fence-end');
    fs.rmSync(tmpDir, { recursive: true });
  });
});

describe('checkGeneratedFile', () => {
  it('returns upToDate true when file matches', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'snippetfence-gen-'));
    writeGeneratedFile(tmpDir, { format: 'agents-md' });
    const { upToDate } = checkGeneratedFile(tmpDir, { format: 'agents-md' });
    expect(upToDate).toBe(true);
    fs.rmSync(tmpDir, { recursive: true });
  });

  it('returns upToDate false when file is stale', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'snippetfence-gen-'));
    writeGeneratedFile(tmpDir, { format: 'agents-md' });
    fs.writeFileSync(path.join(tmpDir, 'AGENTS.md'), 'stale content\n', 'utf-8');
    const { upToDate } = checkGeneratedFile(tmpDir, { format: 'agents-md' });
    expect(upToDate).toBe(false);
    fs.rmSync(tmpDir, { recursive: true });
  });

  it('returns upToDate false when file is missing', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'snippetfence-gen-'));
    const { upToDate } = checkGeneratedFile(tmpDir, { format: 'agents-md' });
    expect(upToDate).toBe(false);
    fs.rmSync(tmpDir, { recursive: true });
  });
});
