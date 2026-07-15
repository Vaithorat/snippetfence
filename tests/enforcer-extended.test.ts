import { describe, it, expect } from 'vitest';
import * as path from 'node:path';
import { extractDiffHunk, checkViolations } from '../src/enforcer.js';
import type { ProtectedRegion } from '../src/types.js';

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
  const ABS_PATH = path.resolve('test/file.ts');

  const makeRegion = (id: string, start: number, end: number): ProtectedRegion => ({
    id,
    startLine: start,
    endLine: end,
    filePath: ABS_PATH,
    reason: 'test',
  });

  it('detects violations when changed lines overlap region', () => {
    const regions = [makeRegion('r1', 10, 20)];
    const changedLines = [12, 15];
    const violations = checkViolations(regions, changedLines, 'test/file.ts');
    expect(violations).toHaveLength(2);
    expect(violations[0].modifiedLine).toBe(12);
    expect(violations[1].modifiedLine).toBe(15);
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

  it('reports all violations per region (no early break)', () => {
    const regions = [makeRegion('r1', 10, 20)];
    const changedLines = [11, 12, 13, 14, 15];
    const violations = checkViolations(regions, changedLines, 'test/file.ts');
    expect(violations).toHaveLength(5);
  });
});
