import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { extractDiffHunk, checkAllChanges, checkRefChanges, checkStagedChanges, checkWorkingTreeChanges, checkViolations } from '../src/enforcer.js';
import type { ProtectedRegion } from '../src/types.js';

const ABS_PATH = path.resolve('test/file.ts');

function makeRegion(id: string, start: number, end: number): ProtectedRegion {
  return {
    id,
    startLine: start,
    endLine: end,
    filePath: ABS_PATH,
    reason: 'test',
    severity: 'error',
  };
}

function initRepo(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'snippetfence-enforcer-'));
  execFileSync('git', ['init'], { cwd: dir, stdio: 'pipe' });
  execFileSync('git', ['config', 'user.name', 'SnippetFence Test'], { cwd: dir, stdio: 'pipe' });
  execFileSync('git', ['config', 'user.email', 'test@example.com'], { cwd: dir, stdio: 'pipe' });
  return dir;
}

function writeRepoFile(repoDir: string, filePath: string, content: string): void {
  const absPath = path.join(repoDir, filePath);
  fs.mkdirSync(path.dirname(absPath), { recursive: true });
  fs.writeFileSync(absPath, content, 'utf-8');
}

function commitAll(repoDir: string, message: string): void {
  execFileSync('git', ['add', '.'], { cwd: repoDir, stdio: 'pipe' });
  execFileSync('git', ['commit', '-m', message], { cwd: repoDir, stdio: 'pipe' });
}

describe('extractDiffHunk', () => {
  it('extracts the hunk containing a specific line', () => {
    const diff = `@@ -5,3 +5,3 @@
 context
-old
+new
 context2
@@ -20,2 +20,2 @@
-a
+b`;
    const hunk = extractDiffHunk(diff, 6);
    expect(hunk).toContain('@@ -5,3 +5,3 @@');
    expect(hunk).toContain('+new');
  });

  it('returns empty string when line not in any hunk', () => {
    const diff = `@@ -5,1 +5,1 @@
-old
+new`;
    const hunk = extractDiffHunk(diff, 100);
    expect(hunk).toBe('');
  });

  it('returns empty string for empty diff', () => {
    const hunk = extractDiffHunk('', 5);
    expect(hunk).toBe('');
  });

  it('handles hunk with omitted count (count of 1)', () => {
    const diff = `@@ -1 +1 @@
-a
+b`;
    const hunk = extractDiffHunk(diff, 1);
    expect(hunk).toContain('@@ -1 +1 @@');
  });
});

describe('checkViolations', () => {
  it('detects violations when changed lines overlap region', () => {
    const regions = [makeRegion('r1', 10, 20)];
    const changedLines = [12, 15];
    const violations = checkViolations(regions, changedLines, 'test/file.ts');
    expect(violations).toHaveLength(1);
    expect(violations[0].modifiedLine).toBe(12);
    expect(violations[0].modifiedLines).toEqual([12, 15]);
  });

  it('returns empty when no overlap', () => {
    const regions = [makeRegion('r1', 10, 20)];
    const changedLines = [5, 25];
    const violations = checkViolations(regions, changedLines, 'test/file.ts');
    expect(violations).toHaveLength(0);
  });

  it('returns empty for empty changed lines', () => {
    const regions = [makeRegion('r1', 10, 20)];
    const violations = checkViolations(regions, [], 'test/file.ts');
    expect(violations).toHaveLength(0);
  });

  it('populates diffHunk when diff is provided', () => {
    const regions = [makeRegion('r1', 5, 5)];
    const changedLines = [5];
    const diff = `@@ -3,3 +3,3 @@
 context
-old
+new
 context2`;
    const violations = checkViolations(regions, changedLines, 'test/file.ts', diff);
    expect(violations).toHaveLength(1);
    expect(violations[0].diffHunk).toContain('@@ -3,3 +3,3 @@');
  });

  it('leaves diffHunk empty when diff not provided', () => {
    const regions = [makeRegion('r1', 5, 5)];
    const changedLines = [5];
    const violations = checkViolations(regions, changedLines, 'test/file.ts');
    expect(violations).toHaveLength(1);
    expect(violations[0].diffHunk).toBe('');
  });

  it('groups all modified lines per region (no early break)', () => {
    const regions = [makeRegion('r1', 10, 20)];
    const changedLines = [11, 12, 13, 14, 15];
    const violations = checkViolations(regions, changedLines, 'test/file.ts');
    expect(violations).toHaveLength(1);
    expect(violations[0].modifiedLines).toEqual([11, 12, 13, 14, 15]);
  });
});

describe('git-backed enforcement', () => {
  it('detects deletion-only staged changes inside fenced regions', () => {
    const repoDir = initRepo();

    writeRepoFile(repoDir, 'protected.ts', `// @fence-begin auth\nconst one = 1;\nconst two = 2;\n// @fence-end\n`);
    commitAll(repoDir, 'initial');

    writeRepoFile(repoDir, 'protected.ts', `// @fence-begin auth\nconst one = 1;\n// @fence-end\n`);
    execFileSync('git', ['add', 'protected.ts'], { cwd: repoDir, stdio: 'pipe' });

    const result = checkStagedChanges(repoDir);
    expect(result.passed).toBe(false);
    expect(result.violations.length).toBeGreaterThan(0);
    expect(result.violations[0].diffHunk).toContain('-const two = 2;');

    fs.rmSync(repoDir, { recursive: true, force: true });
  });

  it('checks staged changes when --all behavior is requested', () => {
    const repoDir = initRepo();

    writeRepoFile(repoDir, 'protected.ts', `// @fence-begin auth\nconst value = 1;\n// @fence-end\n`);
    commitAll(repoDir, 'initial');

    writeRepoFile(repoDir, 'protected.ts', `// @fence-begin auth\nconst value = 2;\n// @fence-end\n`);
    execFileSync('git', ['add', 'protected.ts'], { cwd: repoDir, stdio: 'pipe' });

    const result = checkAllChanges(repoDir);
    expect(result.passed).toBe(false);
    expect(result.violations.length).toBeGreaterThan(0);

    fs.rmSync(repoDir, { recursive: true, force: true });
  });

  it('checks untracked files when --all behavior is requested', () => {
    const repoDir = initRepo();
    writeRepoFile(repoDir, 'README.md', '# test\n');
    commitAll(repoDir, 'initial');

    writeRepoFile(repoDir, 'new-protected.ts', `// @fence-begin auth\nconst value = 1;\n// @fence-end\n`);

    const result = checkAllChanges(repoDir);
    expect(result.passed).toBe(false);
    expect(result.filesChecked).toBe(1);
    expect(result.violations.length).toBeGreaterThan(0);

    fs.rmSync(repoDir, { recursive: true, force: true });
  });

  it('checks protected changes between supplied refs', () => {
    const repoDir = initRepo();

    writeRepoFile(repoDir, 'snippetfence.yml', 'defaults:\n  severity: error\n');
    writeRepoFile(repoDir, 'protected.ts', `// @fence-begin auth\nconst value = 1;\n// @fence-end\n`);
    commitAll(repoDir, 'initial');
    const baseRef = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repoDir, encoding: 'utf-8', stdio: 'pipe' }).trim();

    writeRepoFile(repoDir, 'protected.ts', `// @fence-begin auth\nconst value = 2;\n// @fence-end\n`);
    commitAll(repoDir, 'updated');
    const headRef = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repoDir, encoding: 'utf-8', stdio: 'pipe' }).trim();

    const result = checkRefChanges(repoDir, baseRef, headRef);
    expect(result.passed).toBe(false);
    expect(result.violations.length).toBeGreaterThan(0);

    fs.rmSync(repoDir, { recursive: true, force: true });
  });

  it('treats warn-level policy as non-blocking when fail-on error is used', () => {
    const repoDir = initRepo();

    writeRepoFile(repoDir, 'snippetfence.yml', [
      'rules:',
      '  - paths:',
      '      - "protected.ts"',
      '    severity: warn',
      '',
    ].join('\n'));
    writeRepoFile(repoDir, 'protected.ts', `// @fence-begin auth\nconst value = 1;\n// @fence-end\n`);
    commitAll(repoDir, 'initial');

    writeRepoFile(repoDir, 'protected.ts', `// @fence-begin auth\nconst value = 2;\n// @fence-end\n`);
    execFileSync('git', ['add', 'protected.ts'], { cwd: repoDir, stdio: 'pipe' });

    const result = checkStagedChanges(repoDir, { failOn: 'error' });
    expect(result.passed).toBe(true);
    expect(result.warningCount).toBeGreaterThan(0);
    expect(result.errorCount).toBe(0);

    fs.rmSync(repoDir, { recursive: true, force: true });
  });
});

describe('v1.2 - deleted file detection', () => {
  it('detects staged deletion of a fenced file', () => {
    const repoDir = initRepo();
    writeRepoFile(repoDir, 'protected.ts', '// @fence-begin auth\nconst secret = 1;\n// @fence-end\n');
    commitAll(repoDir, 'initial');

    execFileSync('git', ['rm', 'protected.ts'], { cwd: repoDir, stdio: 'pipe' });

    const result = checkStagedChanges(repoDir);
    expect(result.passed).toBe(false);
    expect(result.violations.length).toBe(1);
    expect(result.violations[0].deletedFile).toBe(true);
    expect(result.violations[0].region.startLine).toBe(1);
    expect(result.violations[0].region.endLine).toBe(3);

    fs.rmSync(repoDir, { recursive: true, force: true });
  });

  it('reports deleted file violations between refs', () => {
    const repoDir = initRepo();
    writeRepoFile(repoDir, 'protected.ts', '// @fence-begin auth\nconst secret = 1;\n// @fence-end\n');
    commitAll(repoDir, 'initial');
    const base = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repoDir, encoding: 'utf-8', stdio: 'pipe' }).trim();

    execFileSync('git', ['rm', 'protected.ts'], { cwd: repoDir, stdio: 'pipe' });
    commitAll(repoDir, 'delete');
    const head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repoDir, encoding: 'utf-8', stdio: 'pipe' }).trim();

    const result = checkRefChanges(repoDir, base, head);
    expect(result.passed).toBe(false);
    expect(result.violations.some(v => v.deletedFile)).toBe(true);

    fs.rmSync(repoDir, { recursive: true, force: true });
  });

  it('does not flag deletion of unprotected file', () => {
    const repoDir = initRepo();
    writeRepoFile(repoDir, 'normal.ts', 'const x = 1;\n');
    commitAll(repoDir, 'initial');

    execFileSync('git', ['rm', 'normal.ts'], { cwd: repoDir, stdio: 'pipe' });

    const result = checkStagedChanges(repoDir);
    expect(result.passed).toBe(true);
    expect(result.violations).toHaveLength(0);

    fs.rmSync(repoDir, { recursive: true, force: true });
  });
});

describe('v1.2 - rename detection', () => {
  it('flags rename that strips fence markers', () => {
    const repoDir = initRepo();
    writeRepoFile(repoDir, 'secret.ts', '// @fence-begin auth\nconst secret = 1;\nconst keep = true;\n// @fence-end\n');
    commitAll(repoDir, 'initial');
    const base = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repoDir, encoding: 'utf-8', stdio: 'pipe' }).trim();

    execFileSync('git', ['mv', 'secret.ts', 'exposed.ts'], { cwd: repoDir, stdio: 'pipe' });
    fs.writeFileSync(path.join(repoDir, 'exposed.ts'), 'const secret = 1;\nconst keep = true;\n', 'utf-8');
    commitAll(repoDir, 'rename and strip fences');
    const head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repoDir, encoding: 'utf-8', stdio: 'pipe' }).trim();

    const result = checkRefChanges(repoDir, base, head);
    expect(result.passed).toBe(false);
    expect(result.violations.some(v => v.diffHunk.includes('rename from'))).toBe(true);

    fs.rmSync(repoDir, { recursive: true, force: true });
  });

  it('does not flag rename that preserves fence markers', () => {
    const repoDir = initRepo();
    writeRepoFile(repoDir, 'secret.ts', '// @fence-begin auth\nconst secret = 1;\nconst keep = true;\n// @fence-end\n');
    commitAll(repoDir, 'initial');
    const base = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repoDir, encoding: 'utf-8', stdio: 'pipe' }).trim();

    execFileSync('git', ['mv', 'secret.ts', 'renamed.ts'], { cwd: repoDir, stdio: 'pipe' });
    commitAll(repoDir, 'rename only');
    const head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repoDir, encoding: 'utf-8', stdio: 'pipe' }).trim();

    const result = checkRefChanges(repoDir, base, head);
    expect(result.passed).toBe(true);
    expect(result.violations).toHaveLength(0);

    fs.rmSync(repoDir, { recursive: true, force: true });
  });

  it('flags staged rename that strips fence markers', () => {
    const repoDir = initRepo();
    writeRepoFile(repoDir, 'secret.ts', '// @fence-begin auth\nconst secret = 1;\nconst keep = true;\n// @fence-end\n');
    commitAll(repoDir, 'initial');

    execFileSync('git', ['mv', 'secret.ts', 'exposed.ts'], { cwd: repoDir, stdio: 'pipe' });
    fs.writeFileSync(path.join(repoDir, 'exposed.ts'), 'const secret = 1;\nconst keep = true;\n', 'utf-8');
    execFileSync('git', ['add', '.'], { cwd: repoDir, stdio: 'pipe' });

    const result = checkAllChanges(repoDir);
    expect(result.passed).toBe(false);
    expect(result.violations.some(v => v.diffHunk.includes('rename from'))).toBe(true);

    fs.rmSync(repoDir, { recursive: true, force: true });
  });
});

describe('v1.2 - config scope enforcement', () => {
  it('skips excluded files during staged check', () => {
    const repoDir = initRepo();
    writeRepoFile(repoDir, 'snippetfence.yml', 'exclude:\n  - "vendor/**"\n');
    writeRepoFile(repoDir, 'vendor/secret.ts', '// @fence-begin auth\nconst secret = 1;\n// @fence-end\n');
    commitAll(repoDir, 'initial');

    writeRepoFile(repoDir, 'vendor/secret.ts', '// @fence-begin auth\nconst secret = 2;\n// @fence-end\n');
    execFileSync('git', ['add', 'vendor/secret.ts'], { cwd: repoDir, stdio: 'pipe' });

    const result = checkStagedChanges(repoDir);
    expect(result.passed).toBe(true);
    expect(result.violations).toHaveLength(0);

    fs.rmSync(repoDir, { recursive: true, force: true });
  });

  it('enforces only included files', () => {
    const repoDir = initRepo();
    writeRepoFile(repoDir, 'snippetfence.yml', 'include:\n  - "src/**"\n');
    writeRepoFile(repoDir, 'src/protected.ts', '// @fence-begin auth\nconst a = 1;\n// @fence-end\n');
    writeRepoFile(repoDir, 'lib/other.ts', '// @fence-begin auth\nconst b = 1;\n// @fence-end\n');
    commitAll(repoDir, 'initial');

    writeRepoFile(repoDir, 'src/protected.ts', '// @fence-begin auth\nconst a = 2;\n// @fence-end\n');
    writeRepoFile(repoDir, 'lib/other.ts', '// @fence-begin auth\nconst b = 2;\n// @fence-end\n');
    execFileSync('git', ['add', '.'], { cwd: repoDir, stdio: 'pipe' });

    const result = checkStagedChanges(repoDir);
    expect(result.violations).toHaveLength(1);
    expect(result.violations[0].region.filePath).toContain(path.join('src', 'protected.ts'));

    fs.rmSync(repoDir, { recursive: true, force: true });
  });
});

describe('v1.2 - violation grouping', () => {
  it('groups multiple line edits into one violation per region', () => {
    const regions = [makeRegion('r1', 10, 20)];
    const changedLines = [12, 14, 16];
    const violations = checkViolations(regions, changedLines, 'test/file.ts');
    expect(violations).toHaveLength(1);
    expect(violations[0].modifiedLines).toEqual([12, 14, 16]);
  });

  it('creates separate violations for different regions', () => {
    const r1: ProtectedRegion = { id: 'r1', startLine: 1, endLine: 5, filePath: ABS_PATH, severity: 'error' };
    const r2: ProtectedRegion = { id: 'r2', startLine: 20, endLine: 30, filePath: ABS_PATH, severity: 'error' };
    const changedLines = [3, 25];
    const violations = checkViolations([r1, r2], changedLines, 'test/file.ts');
    expect(violations).toHaveLength(2);
    expect(violations[0].modifiedLines).toEqual([3]);
    expect(violations[1].modifiedLines).toEqual([25]);
  });
});

describe('v1.3 - missing base ref', () => {
  it('returns failed result when base ref does not exist', () => {
    const repoDir = initRepo();
    writeRepoFile(repoDir, 'protected.ts', '// @fence-begin auth\nconst secret = 1;\n// @fence-end\n');
    commitAll(repoDir, 'initial');

    const result = checkRefChanges(repoDir, 'nonexistent-ref-abc123', 'HEAD');
    expect(result.passed).toBe(false);
    expect(result.violations).toHaveLength(0);
    expect(result.filesChecked).toBe(0);

    fs.rmSync(repoDir, { recursive: true, force: true });
  });
});

describe('v1.3 - working tree deletion', () => {
  it('detects deletion of a fenced file in working tree', () => {
    const repoDir = initRepo();
    writeRepoFile(repoDir, 'protected.ts', '// @fence-begin auth\nconst secret = 1;\n// @fence-end\n');
    commitAll(repoDir, 'initial');

    fs.unlinkSync(path.join(repoDir, 'protected.ts'));

    const result = checkWorkingTreeChanges(repoDir);
    expect(result.passed).toBe(false);
    expect(result.violations.length).toBe(1);
    expect(result.violations[0].deletedFile).toBe(true);

    fs.rmSync(repoDir, { recursive: true, force: true });
  });

  it('does not flag deletion of unprotected file in working tree', () => {
    const repoDir = initRepo();
    writeRepoFile(repoDir, 'normal.ts', 'const x = 1;\n');
    commitAll(repoDir, 'initial');

    fs.unlinkSync(path.join(repoDir, 'normal.ts'));

    const result = checkWorkingTreeChanges(repoDir);
    expect(result.passed).toBe(true);
    expect(result.violations).toHaveLength(0);

    fs.rmSync(repoDir, { recursive: true, force: true });
  });
});

describe('v1.3 - ref rename detection', () => {
  it('flags rename that strips fence markers between refs', () => {
    const repoDir = initRepo();
    writeRepoFile(repoDir, 'secret.ts', '// @fence-begin auth\nconst secret = 1;\nconst keep = true;\n// @fence-end\n');
    commitAll(repoDir, 'initial');
    const base = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repoDir, encoding: 'utf-8', stdio: 'pipe' }).trim();

    execFileSync('git', ['mv', 'secret.ts', 'exposed.ts'], { cwd: repoDir, stdio: 'pipe' });
    fs.writeFileSync(path.join(repoDir, 'exposed.ts'), 'const secret = 1;\nconst keep = true;\n', 'utf-8');
    commitAll(repoDir, 'rename and strip fences');
    const head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repoDir, encoding: 'utf-8', stdio: 'pipe' }).trim();

    const result = checkRefChanges(repoDir, base, head);
    expect(result.passed).toBe(false);
    expect(result.violations.some(v => v.diffHunk.includes('rename from'))).toBe(true);

    fs.rmSync(repoDir, { recursive: true, force: true });
  });

  it('does not flag rename that preserves fence markers between refs', () => {
    const repoDir = initRepo();
    writeRepoFile(repoDir, 'secret.ts', '// @fence-begin auth\nconst secret = 1;\nconst keep = true;\n// @fence-end\n');
    commitAll(repoDir, 'initial');
    const base = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repoDir, encoding: 'utf-8', stdio: 'pipe' }).trim();

    execFileSync('git', ['mv', 'secret.ts', 'renamed.ts'], { cwd: repoDir, stdio: 'pipe' });
    commitAll(repoDir, 'rename only');
    const head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repoDir, encoding: 'utf-8', stdio: 'pipe' }).trim();

    const result = checkRefChanges(repoDir, base, head);
    expect(result.passed).toBe(true);
    expect(result.violations).toHaveLength(0);

    fs.rmSync(repoDir, { recursive: true, force: true });
  });
});

describe('v1.3 - config scope with checkAllChanges', () => {
  it('skips excluded files during checkAllChanges', { timeout: 15000 }, () => {
    const repoDir = initRepo();
    writeRepoFile(repoDir, 'snippetfence.yml', 'exclude:\n  - "vendor/**"\n');
    writeRepoFile(repoDir, 'vendor/secret.ts', '// @fence-begin auth\nconst secret = 1;\n// @fence-end\n');
    commitAll(repoDir, 'initial');

    writeRepoFile(repoDir, 'vendor/secret.ts', '// @fence-begin auth\nconst secret = 2;\n// @fence-end\n');
    execFileSync('git', ['add', 'vendor/secret.ts'], { cwd: repoDir, stdio: 'pipe' });

    const result = checkAllChanges(repoDir);
    expect(result.passed).toBe(true);
    expect(result.violations).toHaveLength(0);

    fs.rmSync(repoDir, { recursive: true, force: true });
  });

  it('enforces only included files in checkAllChanges', () => {
    const repoDir = initRepo();
    writeRepoFile(repoDir, 'snippetfence.yml', 'include:\n  - "src/**"\n');
    writeRepoFile(repoDir, 'src/protected.ts', '// @fence-begin auth\nconst a = 1;\n// @fence-end\n');
    writeRepoFile(repoDir, 'lib/other.ts', '// @fence-begin auth\nconst b = 1;\n// @fence-end\n');
    commitAll(repoDir, 'initial');

    writeRepoFile(repoDir, 'src/protected.ts', '// @fence-begin auth\nconst a = 2;\n// @fence-end\n');
    writeRepoFile(repoDir, 'lib/other.ts', '// @fence-begin auth\nconst b = 2;\n// @fence-end\n');
    execFileSync('git', ['add', '.'], { cwd: repoDir, stdio: 'pipe' });

    const result = checkAllChanges(repoDir);
    expect(result.violations).toHaveLength(1);
    expect(result.violations[0].region.filePath).toContain(path.join('src', 'protected.ts'));

    fs.rmSync(repoDir, { recursive: true, force: true });
  });
});
