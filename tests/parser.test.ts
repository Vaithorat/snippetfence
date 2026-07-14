import { describe, it, expect, beforeEach } from 'vitest';
import { parseContent, resetCounter } from '../src/parser.js';

describe('parseContent', () => {
  beforeEach(() => {
    resetCounter();
  });

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
    expect(regions[0].endLine).toBe(5); // last line (trailing empty from template literal)
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
    expect(regions[0].reason).toBe('form');
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
});
