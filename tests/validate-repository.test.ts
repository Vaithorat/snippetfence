import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { validateRepository } from '../src/validate.js';

function tmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'snippetfence-validate-'));
}

describe('validateRepository', () => {
  it('passes for a clean repo config and well-formed fences', () => {
    const dir = tmpDir();
    fs.mkdirSync(path.join(dir, 'src'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'snippetfence.yml'), 'defaults:\n  severity: error\n');
    fs.writeFileSync(path.join(dir, 'src', 'index.ts'), '// @fence-begin auth\nconst a = 1;\n// @fence-end\n');

    const result = validateRepository(dir);
    expect(result.passed).toBe(true);
    expect(result.issues).toEqual([]);
    expect(result.filesChecked).toBe(2);
    expect(result.regionsChecked).toBe(1);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('reports config and fence issues together', () => {
    const dir = tmpDir();
    fs.mkdirSync(path.join(dir, 'src'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'snippetfence.yml'), 'unknown: true\n');
    fs.writeFileSync(path.join(dir, 'src', 'broken.ts'), '// @fence-begin auth\nconst a = 1;\n');

    const result = validateRepository(dir);
    expect(result.passed).toBe(false);
    expect(result.issues.some(issue => issue.source === 'config')).toBe(true);
    expect(result.issues.some(issue => issue.source === 'fence' && issue.code === 'unclosed')).toBe(true);
    expect(result.filesChecked).toBe(2);
    fs.rmSync(dir, { recursive: true, force: true });
  });
});
