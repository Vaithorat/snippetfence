import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { createMcpServer, getProtectionResult, listProtectionResults } from '../src/mcp-server.js';

function tmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'snippetfence-mcp-'));
}

describe('createMcpServer', () => {
  it('creates a server instance with connect method', async () => {
    const server = await createMcpServer();
    expect(server).toBeDefined();
    expect(typeof server.connect).toBe('function');
    expect(typeof server.close).toBe('function');
  });
});

describe('MCP helpers', () => {
  it('returns policy metadata in protection checks', () => {
    const dir = tmpDir();
    const filePath = path.join(dir, 'payments.ts');
    fs.writeFileSync(path.join(dir, 'snippetfence.yml'), [
      'rules:',
      '  - paths:',
      '      - "payments.ts"',
      '    severity: error',
      '    owners:',
      '      - security',
      '    tags:',
      '      - pci',
      '    message: Requires security review',
      '',
    ].join('\n'));
    fs.writeFileSync(filePath, '// @fence-begin payment\nconst x = 1;\n// @fence-end\n');

    const result = getProtectionResult(filePath, 1, 3) as { protected: boolean; regions: Array<Record<string, unknown>> };
    expect(result.protected).toBe(true);
    expect(result.regions[0].severity).toBe('error');
    expect(result.regions[0].owners).toEqual(['security']);
    expect(result.regions[0].tags).toEqual(['pci']);
    expect(result.regions[0].message).toBe('Requires security review');
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('lists protections with relative file paths', () => {
    const dir = tmpDir();
    fs.writeFileSync(path.join(dir, 'snippetfence.yml'), 'defaults:\n  severity: warn\n');
    fs.mkdirSync(path.join(dir, 'nested'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'nested', 'index.ts'), '// @fence-begin auth\nconst x = 1;\n// @fence-end\n');

    const result = listProtectionResults(dir);
    expect(result).toHaveLength(1);
    expect(result[0].file).toBe('nested/index.ts');
    expect(result[0].severity).toBe('warn');
    fs.rmSync(dir, { recursive: true, force: true });
  });
});
