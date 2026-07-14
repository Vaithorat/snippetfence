import { describe, it, expect, beforeAll } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateInstructions } from '../src/generate.js';
import { resetCounter } from '../src/parser.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = path.join(__dirname, 'fixtures');

describe('generateInstructions', () => {
  beforeAll(() => {
    resetCounter();
  });

  it('generates CLAUDE.md format with regions from fixtures', () => {
    const result = generateInstructions(FIXTURES_DIR, { format: 'claude-md' });
    expect(result).toContain('## Protected Code Regions');
    expect(result).toContain('@fence-begin');
    expect(result).toContain('@fence-end');
  });

  it('generates AGENTS.md format with regions from fixtures', () => {
    const result = generateInstructions(FIXTURES_DIR, { format: 'agents-md' });
    expect(result).toContain('## Code Protection');
    expect(result).toContain('snippetfence list');
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

  it('generates GEMINI.md format', () => {
    const result = generateInstructions(FIXTURES_DIR, { format: 'gemini-md' });
    expect(result).toContain('## Code Protection');
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
