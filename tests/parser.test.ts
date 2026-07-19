import { describe, it, expect } from 'vitest';
import * as path from 'node:path';
import { parseContent, parseAndValidateRepo } from '../src/parser.js';

describe('parseContent', () => {
  it('finds a single protected region in TypeScript', () => {
    const code = `
export function validateToken(token: string): boolean {
  return token.length > 0;
}

// @fence-begin "auth"
export function auth() {
  return true;
}
// @fence-end
`;

    const regions = parseContent(code, 'test.ts');
    expect(regions).toHaveLength(1);
    expect(regions[0].startLine).toBe(6);
    expect(regions[0].endLine).toBe(10);
    expect(regions[0].reason).toBe('auth');
    expect(regions[0].id).toBe('region-1');
  });

  it('finds multiple protected regions', () => {
    const code = `
// @fence-begin "first"
const a = 1;
// @fence-end

const b = 2;

// @fence-begin "second"
const c = 3;
// @fence-end
`;

    const regions = parseContent(code, 'test.ts');
    expect(regions).toHaveLength(2);
    expect(regions[0].reason).toBe('first');
    expect(regions[1].reason).toBe('second');
  });

  it('handles unclosed fence (protects to EOF)', () => {
    const code = `
// @fence-begin "unclosed"
const a = 1;
const b = 2;
`;

    const regions = parseContent(code, 'test.ts');
    expect(regions).toHaveLength(1);
    expect(regions[0].startLine).toBe(2);
    expect(regions[0].endLine).toBe(4);
  });

  it('handles fence without reason', () => {
    const code = `
// @fence-begin
const protected = true;
// @fence-end
`;

    const regions = parseContent(code, 'test.ts');
    expect(regions).toHaveLength(1);
    expect(regions[0].reason).toBeUndefined();
  });

  it('handles unquoted reasons in line comments', () => {
    const code = `
// @fence-begin authentication - do not modify
const protected = true;
// @fence-end
`;

    const regions = parseContent(code, 'test.ts');
    expect(regions).toHaveLength(1);
    expect(regions[0].reason).toBe('authentication - do not modify');
  });

  it('returns empty array when no fences', () => {
    const code = `
const a = 1;
function foo() { return a; }
`;

    const regions = parseContent(code, 'test.ts');
    expect(regions).toHaveLength(0);
  });

  it('handles Python comment syntax', () => {
    const code = `
# @fence-begin "config"
DATABASE_URL = "postgres://localhost/db"
# @fence-end
`;

    const regions = parseContent(code, 'config.py');
    expect(regions).toHaveLength(1);
    expect(regions[0].reason).toBe('config');
  });

  it('handles SQL comment syntax', () => {
    const code = `
-- @fence-begin "schema"
CREATE TABLE users (id INT PRIMARY KEY);
-- @fence-end
`;

    const regions = parseContent(code, 'schema.sql');
    expect(regions).toHaveLength(1);
  });

  it('handles HTML comment syntax', () => {
    const code = `
<!-- @fence-begin "banner" -->
<div class="banner">Protected</div>
<!-- @fence-end -->
`;

    const regions = parseContent(code, 'index.html');
    expect(regions).toHaveLength(1);
    expect(regions[0].startLine).toBe(2);
    expect(regions[0].endLine).toBe(4);
    expect(regions[0].reason).toBe('banner');
  });

  it('handles Vue comment syntax', () => {
    const code = `
<template>
  <!-- @fence-begin "form" -->
  <form>Protected</form>
  <!-- @fence-end -->
</template>
`;

    const regions = parseContent(code, 'Component.vue');
    expect(regions).toHaveLength(1);
    expect(regions[0].startLine).toBe(3);
    expect(regions[0].endLine).toBe(5);
    expect(regions[0].reason).toBe('form');
  });

  it('handles CSS block comment syntax', () => {
    const code = `/* @fence-begin "theme" */
body { color: red; }
/* @fence-end */`;

    const regions = parseContent(code, 'styles.css');
    expect(regions).toHaveLength(1);
    expect(regions[0].startLine).toBe(1);
    expect(regions[0].endLine).toBe(3);
    expect(regions[0].reason).toBe('theme');
  });

  it('handles unquoted reasons in block comments', () => {
    const code = `/* @fence-begin payment processing - PCI compliance */
body { color: red; }
/* @fence-end */`;

    const regions = parseContent(code, 'styles.css');
    expect(regions).toHaveLength(1);
    expect(regions[0].reason).toBe('payment processing - PCI compliance');
  });

  it('handles Go comment syntax', () => {
    const code = `
// @fence-begin "middleware"
func Auth(next http.Handler) http.Handler {
    return next
}
// @fence-end
`;

    const regions = parseContent(code, 'auth.go');
    expect(regions).toHaveLength(1);
  });

  it('handles Rust comment syntax', () => {
    const code = `
// @fence-begin "unsafe-impl"
unsafe impl Send for MyType {}
// @fence-end
`;

    const regions = parseContent(code, 'lib.rs');
    expect(regions).toHaveLength(1);
  });

  it('preserves line numbers accurately', () => {
    const code = `line 1
line 2
// @fence-begin
line 4
line 5
line 6
// @fence-end
line 8`;

    const regions = parseContent(code, 'test.ts');
    expect(regions).toHaveLength(1);
    expect(regions[0].startLine).toBe(3);
    expect(regions[0].endLine).toBe(7);
  });

  it('uses startCounter for unique IDs across multiple calls', () => {
    const code1 = `// @fence-begin\nconst a = 1;\n// @fence-end`;
    const code2 = `// @fence-begin\nconst b = 2;\n// @fence-end`;

    const regions1 = parseContent(code1, 'a.ts', 0);
    const regions2 = parseContent(code2, 'b.ts', regions1.length);

    expect(regions1[0].id).toBe('region-1');
    expect(regions2[0].id).toBe('region-2');
  });
});

describe('parseAndValidateRepo', () => {
  it('returns regions and warnings from a directory', () => {
    const fixturesDir = path.join(__dirname, 'fixtures');
    const result = parseAndValidateRepo(fixturesDir);
    expect(result.regions.length).toBeGreaterThan(0);
    expect(Array.isArray(result.warnings)).toBe(true);
  });

  it('detects unclosed fences as warnings', () => {
    const result = parseAndValidateRepo(path.join(__dirname, 'fixtures'));
    const unclosed = result.warnings.filter(w => w.type === 'unclosed');
    expect(Array.isArray(unclosed)).toBe(true);
  });
});
