import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { addFence } from '../src/add.js';

function tmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'snippetfence-add-'));
}

describe('addFence', () => {
  it('adds line-comment fences to TypeScript files', () => {
    const dir = tmpDir();
    const filePath = path.join(dir, 'example.ts');
    fs.writeFileSync(filePath, 'const a = 1;\nconst b = 2;\n', 'utf-8');

    addFence(filePath, { startLine: 1, endLine: 2, reason: 'auth' });

    const updated = fs.readFileSync(filePath, 'utf-8');
    expect(updated).toContain('// @fence-begin auth');
    expect(updated).toContain('// @fence-end');
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('adds block-comment fences when requested', () => {
    const dir = tmpDir();
    const filePath = path.join(dir, 'index.html');
    fs.writeFileSync(filePath, '<div>one</div>\n<div>two</div>\n', 'utf-8');

    addFence(filePath, { startLine: 1, endLine: 2, reason: 'payment', style: 'block' });

    const updated = fs.readFileSync(filePath, 'utf-8');
    expect(updated).toContain('<!-- @fence-begin payment -->');
    expect(updated).toContain('<!-- @fence-end -->');
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('preserves CRLF line endings', () => {
    const dir = tmpDir();
    const filePath = path.join(dir, 'example.py');
    fs.writeFileSync(filePath, 'x = 1\r\ny = 2\r\n', 'utf-8');

    addFence(filePath, { startLine: 1, endLine: 2, reason: 'auth' });

    const updated = fs.readFileSync(filePath, 'utf-8');
    expect(updated.startsWith('# @fence-begin auth\r\n')).toBe(true);
    expect(updated).toContain('\r\n# @fence-end\r\n');
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('rejects overlapping existing regions', () => {
    const dir = tmpDir();
    const filePath = path.join(dir, 'example.ts');
    fs.writeFileSync(filePath, '// @fence-begin auth\nconst a = 1;\n// @fence-end\nconst b = 2;\n', 'utf-8');

    expect(() => addFence(filePath, { startLine: 1, endLine: 2 })).toThrow(/overlaps existing protected region/);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('rejects invalid ranges', () => {
    const dir = tmpDir();
    const filePath = path.join(dir, 'example.ts');
    fs.writeFileSync(filePath, 'const a = 1;\n', 'utf-8');

    expect(() => addFence(filePath, { startLine: 2, endLine: 1 })).toThrow(/start must be less than or equal to end/);
    expect(() => addFence(filePath, { startLine: 1, endLine: 5 })).toThrow(/outside the file/);
    fs.rmSync(dir, { recursive: true, force: true });
  });
});
