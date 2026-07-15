import { describe, it, expect } from 'vitest';
import { generateInstructions } from '../src/generate.js';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = path.join(__dirname, 'fixtures');

describe('generateInstructions — new formats', () => {
  it('generates windsurf format with region list', () => {
    const result = generateInstructions(FIXTURES_DIR, { format: 'windsurf' });
    expect(result).toContain('PROTECTED CODE');
    expect(result).toContain('@fence-begin');
    expect(result).toContain('simple.ts');
  });

  it('generates cline format with region list', () => {
    const result = generateInstructions(FIXTURES_DIR, { format: 'cline' });
    expect(result).toContain('SnippetFence Rules');
    expect(result).toContain('@fence-begin');
    expect(result).toContain('snippetfence list');
    expect(result).toContain('simple.ts');
  });

  it('windsurf handles empty regions', () => {
    const result = generateInstructions('/nonexistent-dir-12345', { format: 'windsurf' });
    expect(result).toContain('No regions currently fenced');
  });

  it('cline handles empty regions', () => {
    const result = generateInstructions('/nonexistent-dir-12345', { format: 'cline' });
    expect(result).toContain('No fenced regions found');
  });

  it('claude-md includes file paths relative to rootDir, not cwd', () => {
    const result = generateInstructions(FIXTURES_DIR, { format: 'claude-md' });
    expect(result).toContain('simple.ts');
    expect(result).toContain('nested.go');
  });

  it('cursor-rules includes file paths relative to rootDir', () => {
    const result = generateInstructions(FIXTURES_DIR, { format: 'cursor-rules' });
    expect(result).toContain('simple.ts');
  });

  it('agents-md includes file paths relative to rootDir', () => {
    const result = generateInstructions(FIXTURES_DIR, { format: 'agents-md' });
    expect(result).toContain('simple.ts');
  });

  it('gemini-md includes file paths relative to rootDir', () => {
    const result = generateInstructions(FIXTURES_DIR, { format: 'gemini-md' });
    expect(result).toContain('simple.ts');
  });
});
