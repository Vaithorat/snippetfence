import { describe, it, expect } from 'vitest';
import { validateFencesInContent } from '../src/parser.js';

describe('validateFencesInContent', () => {
  it('reports no warnings for well-formed fences', () => {
    const code = `
// @fence-begin "auth"
const x = 1;
// @fence-end
`;
    const warnings = validateFencesInContent(code, 'test.ts');
    expect(warnings).toHaveLength(0);
  });

  it('detects unclosed fence', () => {
    const code = `
// @fence-begin "unclosed"
const x = 1;
const y = 2;
`;
    const warnings = validateFencesInContent(code, 'test.ts');
    expect(warnings).toHaveLength(1);
    expect(warnings[0].type).toBe('unclosed');
    expect(warnings[0].line).toBe(2);
  });

  it('detects nested fence', () => {
    const code = `
// @fence-begin "outer"
// @fence-begin "inner"
const x = 1;
// @fence-end
// @fence-end
`;
    const warnings = validateFencesInContent(code, 'test.ts');
    const nested = warnings.filter(w => w.type === 'nested');
    expect(nested).toHaveLength(1);
    expect(nested[0].line).toBe(3);
  });

  it('detects typo @fence-bgin', () => {
    const code = `// @fence-bgin "test"`;
    const warnings = validateFencesInContent(code, 'test.ts');
    const typos = warnings.filter(w => w.type === 'typo');
    expect(typos).toHaveLength(1);
    expect(typos[0].message).toContain('@fence-begin');
  });

  it('detects typo @fence-begn', () => {
    const code = `// @fence-begn "test"`;
    const warnings = validateFencesInContent(code, 'test.ts');
    const typos = warnings.filter(w => w.type === 'typo');
    expect(typos).toHaveLength(1);
  });

  it('detects typo @fence-edn', () => {
    const code = `// @fence-edn`;
    const warnings = validateFencesInContent(code, 'test.ts');
    const typos = warnings.filter(w => w.type === 'typo');
    expect(typos).toHaveLength(1);
    expect(typos[0].message).toContain('@fence-end');
  });

  it('does not report typo for non-comment lines', () => {
    const code = `const x = "@fence-bgin";`;
    const warnings = validateFencesInContent(code, 'test.ts');
    const typos = warnings.filter(w => w.type === 'typo');
    expect(typos).toHaveLength(0);
  });

  it('detects typos in Python comments', () => {
    const code = `# @fence-bgin "test"`;
    const warnings = validateFencesInContent(code, 'test.py');
    const typos = warnings.filter(w => w.type === 'typo');
    expect(typos).toHaveLength(1);
  });

  it('detects typos in SQL comments', () => {
    const code = `-- @fence-bgin "test"`;
    const warnings = validateFencesInContent(code, 'test.sql');
    const typos = warnings.filter(w => w.type === 'typo');
    expect(typos).toHaveLength(1);
  });

  it('detects typos in HTML comments', () => {
    const code = `<!-- @fence-bgin "test" -->`;
    const warnings = validateFencesInContent(code, 'test.html');
    const typos = warnings.filter(w => w.type === 'typo');
    expect(typos).toHaveLength(1);
  });

  it('reports multiple warnings', () => {
    const code = `
// @fence-begin "outer"
// @fence-begin "inner"
// @fence-edn
`;
    const warnings = validateFencesInContent(code, 'test.ts');
    expect(warnings.length).toBeGreaterThanOrEqual(2);
    const types = warnings.map(w => w.type);
    expect(types).toContain('nested');
    expect(types).toContain('typo');
  });

  it('returns empty for files with no fences', () => {
    const code = `
const x = 1;
function foo() { return x; }
`;
    const warnings = validateFencesInContent(code, 'test.ts');
    expect(warnings).toHaveLength(0);
  });
});
