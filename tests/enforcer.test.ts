import { describe, it, expect } from 'vitest';
import { parseDiffChangedLines } from '../src/enforcer.js';

describe('parseDiffChangedLines', () => {
  it('extracts changed lines from unified diff', () => {
    const diff = `@@ -10,3 +10,5 @@
 context line
-removed line
+added line 1
+added line 2
+added line 3
 context line`;

    const lines = parseDiffChangedLines(diff);
    expect(lines).toContain(11);
    expect(lines).toContain(12);
    expect(lines).toContain(13);
  });

  it('handles single-line hunk', () => {
    const diff = `@@ -5,1 +5,1 @@
-old
+new`;

    const lines = parseDiffChangedLines(diff);
    expect(lines).toEqual([5]);
  });

  it('handles multiple hunks', () => {
    const diff = `@@ -1,3 +1,3 @@
-a
+b
 c
@@ -10,2 +10,2 @@
-x
+y`;

    const lines = parseDiffChangedLines(diff);
    expect(lines).toContain(1);
    expect(lines).toContain(10);
    expect(lines).toHaveLength(2);
  });

  it('returns empty array for empty diff', () => {
    const lines = parseDiffChangedLines('');
    expect(lines).toEqual([]);
  });

  it('handles hunk with count of 1 (omitted count)', () => {
    const diff = `@@ -1 +1 @@
-a
+b`;

    const lines = parseDiffChangedLines(diff);
    expect(lines).toEqual([1]);
  });

  it('only counts added lines, not context or removed', () => {
    const diff = `@@ -10,3 +10,4 @@
 context line
-old line
+new line 1
+new line 2`;

    const lines = parseDiffChangedLines(diff);
    expect(lines).toEqual([11, 12]);
  });

  it('handles mixed context, removed, and added lines', () => {
    const diff = `@@ -5,6 +5,4 @@
 kept
 removed1
 removed2
+added1
 kept2
 kept3`;

    const lines = parseDiffChangedLines(diff);
    expect(lines).toEqual([8]);
  });
});
